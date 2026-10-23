/** Same-origin API for support inquiries, readiness assessments, and reviewed suppliers. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = path.resolve(projectRoot, process.env.DATABASE_PATH || "server/data/enterseed.sqlite");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

/** Keep private intake and public reviewed listings in separate tables. */
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    supplier_id INTEGER,
    consent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS readiness_records (
    id INTEGER PRIMARY KEY,
    stage TEXT NOT NULL,
    needs_json TEXT NOT NULL,
    location TEXT NOT NULL,
    delete_token_hash TEXT NOT NULL UNIQUE,
    consent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS supplier_applications (
    id INTEGER PRIMARY KEY,
    business_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    public_email TEXT NOT NULL DEFAULT '',
    public_phone TEXT NOT NULL DEFAULT '',
    publish_contact INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    products TEXT NOT NULL,
    website TEXT NOT NULL DEFAULT '',
    consent_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    review_notes TEXT NOT NULL DEFAULT '',
    decision_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY,
    application_id INTEGER NOT NULL UNIQUE REFERENCES supplier_applications(id),
    business_name TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    products TEXT NOT NULL,
    public_email TEXT NOT NULL DEFAULT '',
    public_phone TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    consent_at TEXT NOT NULL,
    verified_at TEXT NOT NULL,
    expires_at TEXT NOT NULL DEFAULT '1970-01-01',
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'withdrawn'))
  );
`);

/** Add columns for existing local SQLite files without discarding stored records. */
function ensureColumn(table, column, definition) {
  const exists = database.prepare(`PRAGMA table_info(${table})`).all().some((entry) => entry.name === column);
  if (!exists) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn("inquiries", "consent_at", "TEXT");
ensureColumn("inquiries", "supplier_id", "INTEGER");
ensureColumn("readiness_records", "consent_at", "TEXT");
ensureColumn("suppliers", "expires_at", "TEXT NOT NULL DEFAULT '1970-01-01'");
database.exec("UPDATE inquiries SET consent_at = created_at WHERE consent_at IS NULL; UPDATE readiness_records SET consent_at = created_at WHERE consent_at IS NULL;");

/** Delete expired intake on startup and daily; approved listings persist until withdrawn. */
function purgeExpiredRecords() {
  database.exec(`
    DELETE FROM readiness_records WHERE created_at < datetime('now', '-30 days');
    DELETE FROM inquiries WHERE created_at < datetime('now', '-180 days');
    DELETE FROM supplier_applications
      WHERE (status = 'pending' AND created_at < datetime('now', '-90 days'))
         OR (status = 'rejected' AND decision_at < datetime('now', '-30 days'));
    UPDATE suppliers SET status = 'withdrawn', public_email = '', public_phone = '', website = ''
      WHERE status = 'active' AND expires_at <= CURRENT_TIMESTAMP;
    UPDATE supplier_applications
      SET contact_name = '', contact_email = '', public_email = '', public_phone = '', website = ''
      WHERE status = 'approved' AND id IN (SELECT application_id FROM suppliers WHERE status = 'withdrawn' AND expires_at <= CURRENT_TIMESTAMP);
  `);
}
purgeExpiredRecords();
const retentionTimer = setInterval(purgeExpiredRecords, 24 * 60 * 60 * 1000);
retentionTimer.unref();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: process.env.NODE_ENV === "production" ? undefined : false,
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://unpkg.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:", "https://*.tile.openstreetmap.org"],
    fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://unpkg.com"],
    connectSrc: ["'self'", "https://nominatim.openstreetmap.org", "https://generativelanguage.googleapis.com"],
    objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"]
  } }
}));
app.use(express.json({ limit: "24kb", type: "application/json" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));
const submissionLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });
const placeSearchLimiter = rateLimit({ windowMs: 1000, limit: 1, standardHeaders: "draft-8", legacyHeaders: false });
const placeSearchCache = new Map();
let lastNominatimRequestAt = 0;
let nominatimQueue = Promise.resolve();

/** Serialize all public Nominatim requests and keep a one-second app-wide interval. */
function requestNominatim(url) {
  const request = nominatimQueue.then(async () => {
    const delay = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastNominatimRequestAt = Date.now();
    return fetch(url, {
      headers: { Accept: "application/json", "User-Agent": process.env.NOMINATIM_USER_AGENT || "EnterseedPrototype/1.0 (local development)" },
      signal: AbortSignal.timeout(10000)
    });
  });
  nominatimQueue = request.then(() => undefined, () => undefined);
  return request;
}

const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100), email: z.email().max(254),
  topic: z.string().trim().min(3).max(80), message: z.string().trim().min(10).max(3000),
  consent: z.literal(true), companyFax: z.string().max(0).optional().default("")
}).strict();
const readinessSchema = z.object({
  stage: z.enum(["unregistered", "registered"]),
  needs: z.array(z.enum(["efiling", "feasibility", "suppliers"])).min(1).max(3),
  location: z.string().trim().min(2).max(80), consent: z.literal(true)
}).strict();
const supplierApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120), contactName: z.string().trim().min(2).max(100),
  contactEmail: z.email().max(254), publicEmail: z.union([z.literal(""), z.email().max(254)]).default(""),
  publicPhone: z.string().trim().max(40).default(""), publishContact: z.boolean(),
  category: z.enum(["raw-materials", "packaging", "services", "marketing"]),
  location: z.string().trim().min(2).max(100), products: z.string().trim().min(10).max(500),
  website: z.union([z.literal(""), z.url().max(300)]).default(""), consent: z.literal(true),
  companyFax: z.string().max(0).optional().default("")
}).strict().refine((entry) => !entry.publishContact || Boolean(entry.publicEmail || entry.publicPhone), {
  message: "Add a public email or phone number, or turn off public contact display.", path: ["publicEmail"]
});
const supplierMessageSchema = z.object({
  name: z.string().trim().min(2).max(100), email: z.email().max(254),
  message: z.string().trim().min(10).max(2000), consent: z.literal(true)
}).strict();
const approvalSchema = z.object({
  identityConfirmed: z.literal(true), businessEvidenceReviewed: z.literal(true),
  contactConfirmed: z.literal(true), locationConfirmed: z.literal(true), listingConsentConfirmed: z.literal(true),
  reviewNotes: z.string().trim().min(20).max(1000)
}).strict();
const assistantSchema = z.object({
  question: z.string().trim().min(2).max(1200),
  history: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(1200) }).strict()).max(8).default([]),
  language: z.enum(["en", "fil"]).default("en")
}).strict();

/** Links and review notes are returned with every AI answer to distinguish link checks from policy review. */
const referenceSources = [
  { label: "DTI Business Name Registration System", url: "https://bnrs.dti.gov.ph/", lastLinkChecked: "2026-10-19", reviewNote: "Official portal; automated access was rate-limited. Confirm current requirements and fees directly." },
  { label: "DTI business-name registration FAQ", url: "https://www.dti.gov.ph/resources/faq/business-name-registration/", lastLinkChecked: "2026-10-19", reviewNote: "Official DTI page; content could not be independently fetched during this review." },
  { label: "South Cotabato Provincial Government services", url: "https://southcotabato.gov.ph/services/", lastLinkChecked: "2026-10-19", reviewNote: "Official provincial website; confirm the relevant office and current process directly." },
  { label: "Koronadal City Government", url: "https://koronadal.gov.ph/", lastLinkChecked: "2026-10-19", reviewNote: "Official city website; permit-specific details were not independently confirmed." }
];
const offlineAnswers = [
  { match: /dti|business name|registration|bnrs|rehistro|pagpaparehistro/i, text: "I can help you get oriented, but I cannot confirm current DTI requirements from this demo. Use the official BNRS portal below to check the latest requirements and fees. Barangay and city or municipal permits are separate LGU processes; ask your municipality which rules apply to your business.", fil: "Makakatulong ako sa pagbibigay ng paunang gabay, pero hindi ko makukumpirma rito ang kasalukuyang mga kinakailangan ng DTI. Tingnan ang opisyal na BNRS portal sa ibaba para sa pinakabagong mga kinakailangan at bayarin. Hiwalay na proseso ng LGU ang mga permit sa barangay, lungsod, o munisipalidad; magtanong sa inyong lokal na tanggapan kung ano ang naaangkop sa negosyo mo." },
  { match: /permit|lgu|barangay|municipal|city|pahintulot|munisipalidad|lungsod/i, text: "Permit requirements depend on your business activity and location. Contact your city or municipal business-permit office for its current checklist. The official provincial and Koronadal links below are starting points, not confirmation that a specific permit rule was reviewed.", fil: "Nakadepende sa uri at lokasyon ng negosyo ang mga kinakailangang permit. Makipag-ugnayan sa tanggapan ng permit sa negosyo ng inyong lungsod o munisipalidad para sa kasalukuyang checklist. Panimulang sanggunian lamang ang mga opisyal na link ng lalawigan at Koronadal sa ibaba; hindi ito kumpirmasyon ng partikular na patakaran sa permit." },
  { match: /feasibility|land bank|loan|business plan|pag-aaral|pautang|plano ng negosyo/i, text: "A feasibility-study draft can organize the market, operations, startup costs, financial assumptions, and risks. Treat projections as your own assumptions, and ask your Land Bank lending officer for the current loan product checklist. This draft is not a loan approval or lending advice.", fil: "Makakatulong ang burador ng feasibility study sa pag-aayos ng impormasyon tungkol sa merkado, operasyon, panimulang gastos, palagay sa pananalapi, at mga panganib. Ituring na sarili mong palagay ang mga proyeksiyon at hingin sa opisyal ng Land Bank ang kasalukuyang checklist ng pautang. Hindi ito pag-apruba ng pautang o payo sa pagpapautang." },
  { match: /supplier|raw material|packaging|local|tagapagtustos|materyales/i, text: "The public supplier directory includes only businesses that opted in and passed Enterseed’s documented review. No supplier is shown until that verification process is complete. Use the supplier-application form to request a review.", fil: "Kasama lamang sa pampublikong direktoryo ng supplier ang mga negosyong kusang sumali at pumasa sa pagsusuri ng Enterseed. Walang supplier na ililista hangga't hindi kumpleto ang beripikasyon. Gamitin ang form ng aplikasyon ng supplier para humiling ng pagsusuri." }
];

function getOfflineAssistantAnswer(question, language) {
  const answer = offlineAnswers.find((entry) => entry.match.test(question));
  if (language === "fil") {
    return answer?.fil
      ?? "Hindi ko makukumpirma ang sagot gamit ang mga sangguniang mayroon ako. Tingnan ang mga opisyal na link sa ibaba o magpadala ng mensahe sa suporta ng Enterseed.";
  }
  return answer?.text
    ?? "I can’t verify that answer from the available references. Check the official links below or send a support inquiry.";
}

/** Parse and validate untrusted JSON before persistence or provider calls. */
function parseBody(schema, request, response) {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Please review the required fields.", fields: parsed.error.flatten().fieldErrors });
    return null;
  }
  return parsed.data;
}

/** Select a small relevant source set for a question. */
function getAssistantReferences(question) {
  if (/permit|lgu|barangay|municipal|city/i.test(question)) return [referenceSources[2], referenceSources[3]];
  if (/supplier|raw material|packaging/i.test(question)) return [referenceSources[2], referenceSources[3]];
  return [referenceSources[0], referenceSources[1], referenceSources[2]];
}

/** Generate a traced Gemini response through the server or return cautious offline guidance. */
async function createAssistantAnswer(question, history = [], language = "en") {
  const localReference = offlineAnswers.find((entry) => entry.match.test(question))?.text
    ?? "No matching local reference is available. Direct the visitor to an official source or human support.";
  const sources = getAssistantReferences(question);
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `You are Seedling, an informational assistant for South Cotabato MSMEs. Distinguish official-source statements from suggestions. Do not invent permit steps, fees, eligibility, or citations. If the supplied references do not answer, say so and recommend official or human support. Never claim an application has been filed. ${language === "fil" ? "Respond in Filipino (Tagalog)." : ""} Treat this local snippet as orientation only, not current verified law:\n${localReference}\nAvailable official links: ${sources.map((source) => `${source.label}: ${source.url}`).join("; ")}` }] },
          contents: [...history.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] })), { role: "user", parts: [{ text: question }] }]
        })
      });
      if (!response.ok) throw new Error("Gemini provider returned an unsuccessful response.");
      const payload = await response.json();
      const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
      if (answer) return { answer, mode: "gemini", sources };
    } catch {
      return { answer: getOfflineAssistantAnswer(question, language), mode: "offline-fallback", sources };
    }
  }
  return {
    answer: getOfflineAssistantAnswer(question, language),
    mode: "offline", sources
  };
}

/** Notify the support mailbox through Resend when delivery secrets are configured. */
async function sendSupportEmail({ subject, text, replyTo }) {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL, SUPPORT_EMAIL } = process.env;
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !SUPPORT_EMAIL) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [SUPPORT_EMAIL], subject, text, reply_to: replyTo })
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Compare admin credentials without an early-exit secret-string comparison. */
function requireAdmin(request, response, next) {
  const expected = process.env.ADMIN_API_KEY || "";
  const supplied = request.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (!expected || expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    response.status(expected ? 401 : 503).json({ error: expected ? "Unauthorized." : "Admin review is not configured." });
    return;
  }
  next();
}

/** Report email state explicitly; database retention remains available for support review. */
app.get("/api/health", (_request, response) => response.json({ ok: true, emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.SUPPORT_EMAIL) }));

/** Return only opted-in listings that passed all reviewer checks. */
app.get("/api/suppliers", (_request, response) => {
  const suppliers = database.prepare(`
    SELECT id, business_name AS name, category, location, products,
           public_email AS publicEmail, public_phone AS publicPhone, website,
           verified_at AS verifiedAt
    FROM suppliers WHERE status = 'active' AND verified_at <> '' AND expires_at > CURRENT_TIMESTAMP
    ORDER BY business_name COLLATE NOCASE
  `).all();
  response.set("Cache-Control", "no-store").json({ suppliers });
});

/** Proxy AI requests so provider credentials never ship to the browser. */
app.post("/api/assistant", submissionLimiter, async (request, response) => {
  const data = parseBody(assistantSchema, request, response);
  if (!data) return;
  const result = await createAssistantAnswer(data.question, data.history, data.language);
  response.set("Cache-Control", "no-store").json(result);
});

/** Proxy one visitor-requested municipality lookup with an identifying user-agent and cache. */
app.get("/api/places/search", placeSearchLimiter, async (request, response) => {
  const parsed = z.string().trim().min(2).max(100).safeParse(request.query.q);
  if (!parsed.success) return response.status(400).json({ error: "Enter a municipality or city name." });
  const query = parsed.data.toLowerCase();
  const cached = placeSearchCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return response.json({ place: cached.place, cached: true });
  try {
    const params = new URLSearchParams({ q: `${parsed.data}, SOCCSKSARGEN, Philippines`, format: "jsonv2", limit: "1", countrycodes: "ph" });
    const result = await requestNominatim(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!result.ok) return response.status(502).json({ error: "OpenStreetMap place search is temporarily unavailable." });
    const [match] = await result.json();
    if (!match) return response.status(404).json({ error: "No matching South Cotabato place was found." });
    const place = { latitude: Number(match.lat), longitude: Number(match.lon), label: match.display_name };
    if (placeSearchCache.size > 500) placeSearchCache.clear();
    placeSearchCache.set(query, { place, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    response.set("Cache-Control", "public, max-age=3600").json({ place, cached: false });
  } catch {
    response.status(502).json({ error: "OpenStreetMap place search is temporarily unavailable." });
  }
});

/** Save a minimal readiness record; no name, email, or contact detail is collected. */
app.post("/api/readiness", submissionLimiter, (request, response) => {
  const data = parseBody(readinessSchema, request, response);
  if (!data) return;
  const deleteToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(deleteToken).digest("hex");
  database.prepare("INSERT INTO readiness_records (stage, needs_json, location, delete_token_hash) VALUES (?, ?, ?, ?)")
    .run(data.stage, JSON.stringify([...new Set(data.needs)]), data.location, tokenHash);
  response.status(201).json({ received: true, deleteToken, retentionDays: 30 });
});

/** Let the browser delete its own readiness record using an unguessable, memory-only token. */
app.delete("/api/readiness/:deleteToken", submissionLimiter, (request, response) => {
  const tokenHash = crypto.createHash("sha256").update(request.params.deleteToken).digest("hex");
  const result = database.prepare("DELETE FROM readiness_records WHERE delete_token_hash = ?").run(tokenHash);
  if (!result.changes) return response.status(404).json({ error: "Assessment was not found or has already expired." });
  response.status(204).end();
});

/** Save support requests and send email only if Resend has been configured. */
app.post("/api/inquiries", submissionLimiter, async (request, response) => {
  const data = parseBody(inquirySchema, request, response);
  if (!data) return;
  if (data.companyFax) return response.status(202).json({ received: true });
  const result = database.prepare("INSERT INTO inquiries (name, email, topic, message) VALUES (?, ?, ?, ?)")
    .run(data.name, data.email, data.topic, data.message);
  const notified = await sendSupportEmail({
    subject: `[Enterseed] ${data.topic}`,
    text: `Name: ${data.name}\nEmail: ${data.email}\nTopic: ${data.topic}\n\n${data.message}`,
    replyTo: data.email
  });
  response.status(201).json({ received: true, reference: Number(result.lastInsertRowid), notified, retentionDays: 180 });
});

/** Accept explicit supplier listing opt-ins; keep every application private until approval. */
app.post("/api/supplier-applications", submissionLimiter, async (request, response) => {
  const data = parseBody(supplierApplicationSchema, request, response);
  if (!data) return;
  if (data.companyFax) return response.status(202).json({ received: true });
  const result = database.prepare(`
    INSERT INTO supplier_applications
      (business_name, contact_name, contact_email, public_email, public_phone, publish_contact,
       category, location, products, website, consent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.businessName, data.contactName, data.contactEmail, data.publishContact ? data.publicEmail : "",
    data.publishContact ? data.publicPhone : "", data.publishContact ? 1 : 0, data.category,
    data.location, data.products, data.website, new Date().toISOString()
  );
  const notified = await sendSupportEmail({
    subject: `[Enterseed] Supplier listing review: ${data.businessName}`,
    text: `Supplier application ${result.lastInsertRowid} is pending review.\nBusiness: ${data.businessName}\nCategory: ${data.category}\nLocation: ${data.location}\nApplicant: ${data.contactName} <${data.contactEmail}>. Review identity, business evidence, contact, location, and publication consent before approval.`,
    replyTo: data.contactEmail
  });
  response.status(201).json({ received: true, status: "pending_review", notified, retentionDays: 90 });
});

/** Route introduction requests only to active verified suppliers and record consented contact requests. */
app.post("/api/suppliers/:id/contact", submissionLimiter, async (request, response) => {
  const data = parseBody(supplierMessageSchema, request, response);
  if (!data) return;
  const supplier = database.prepare(`
    SELECT s.business_name AS businessName, a.contact_email AS contactEmail
    FROM suppliers s JOIN supplier_applications a ON a.id = s.application_id
    WHERE s.id = ? AND s.status = 'active' AND s.verified_at <> '' AND s.expires_at > CURRENT_TIMESTAMP
  `).get(Number(request.params.id));
  if (!supplier) return response.status(404).json({ error: "Reviewed supplier listing not found." });
  const result = database.prepare("INSERT INTO inquiries (name, email, topic, message, supplier_id) VALUES (?, ?, ?, ?, ?)")
    .run(data.name, data.email, `Supplier introduction: ${supplier.businessName}`, data.message, Number(request.params.id));
  const text = `Supplier: ${supplier.businessName}\nFrom: ${data.name} <${data.email}>\n\n${data.message}\n\nThe visitor consented to share this message with the supplier.`;
  const delivered = await sendSupportEmail({ subject: `[Enterseed] Supplier introduction: ${supplier.businessName}`, text, replyTo: data.email });
  if (!delivered) return response.status(201).json({ received: true, reference: Number(result.lastInsertRowid), forwarded: false, retentionDays: 180 });
  try {
    const forwarded = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [supplier.contactEmail], reply_to: data.email, subject: `Enterseed introduction request: ${supplier.businessName}`, text })
    });
    response.status(201).json({ received: true, reference: Number(result.lastInsertRowid), forwarded: forwarded.ok, retentionDays: 180 });
  } catch {
    response.status(201).json({ received: true, reference: Number(result.lastInsertRowid), forwarded: false, retentionDays: 180 });
  }
});

/** List private supplier applications to an authenticated reviewer. */
app.get("/api/admin/supplier-applications", requireAdmin, (_request, response) => {
  const applications = database.prepare(`
    SELECT id, business_name AS businessName, contact_name AS contactName, contact_email AS contactEmail,
           public_email AS publicEmail, public_phone AS publicPhone, publish_contact AS publishContact,
           category, location, products, website, consent_at AS consentAt, created_at AS createdAt
    FROM supplier_applications WHERE status = 'pending' ORDER BY created_at
  `).all();
  response.set("Cache-Control", "no-store").json({ applications });
});

/** Give authenticated reviewers a current listing so consent withdrawal is actionable. */
app.get("/api/admin/suppliers", requireAdmin, (_request, response) => {
  const suppliers = database.prepare(`
    SELECT id, business_name AS businessName, category, location,
           verified_at AS verifiedAt, expires_at AS expiresAt, status
    FROM suppliers ORDER BY verified_at DESC
  `).all();
  response.set("Cache-Control", "no-store").json({ suppliers });
});

/** Approve only when identity, business evidence, contact, location, and listing consent have been checked. */
app.post("/api/admin/supplier-applications/:id/approve", requireAdmin, (request, response) => {
  const checks = parseBody(approvalSchema, request, response);
  if (!checks) return;
  const application = database.prepare("SELECT * FROM supplier_applications WHERE id = ? AND status = 'pending'").get(Number(request.params.id));
  if (!application) return response.status(404).json({ error: "Pending supplier application not found." });
  const verifiedAt = new Date().toISOString();
  let supplierId;
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE supplier_applications SET status='approved', review_notes=?, decision_at=? WHERE id=?")
      .run(checks.reviewNotes, verifiedAt, application.id);
    const inserted = database.prepare(`
      INSERT INTO suppliers (application_id, business_name, category, location, products,
        public_email, public_phone, website, consent_at, verified_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+365 days'))
    `).run(application.id, application.business_name, application.category, application.location, application.products,
      application.publish_contact ? application.public_email : "", application.publish_contact ? application.public_phone : "",
      application.website, application.consent_at, verifiedAt);
    supplierId = Number(inserted.lastInsertRowid);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  response.status(201).json({ approved: true, supplierId, verifiedAt });
});

/** Reject pending applications with a reviewer note retained alongside the decision. */
app.post("/api/admin/supplier-applications/:id/reject", requireAdmin, (request, response) => {
  const data = z.object({ reason: z.string().trim().min(10).max(1000) }).safeParse(request.body);
  if (!data.success) return response.status(400).json({ error: "A review reason of at least 10 characters is required." });
  const result = database.prepare("UPDATE supplier_applications SET status='rejected', review_notes=?, decision_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'")
    .run(data.data.reason, Number(request.params.id));
  if (!result.changes) return response.status(404).json({ error: "Pending supplier application not found." });
  response.json({ rejected: true });
});

/** Withdraw an active public supplier listing when consent is revoked or review expires. */
app.post("/api/admin/suppliers/:id/withdraw", requireAdmin, (request, response) => {
  const id = Number(request.params.id);
  const supplier = database.prepare("SELECT application_id FROM suppliers WHERE id=? AND status='active'").get(id);
  if (!supplier) return response.status(404).json({ error: "Active supplier listing not found." });
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE suppliers SET status='withdrawn', public_email='', public_phone='', website='' WHERE id=?").run(id);
    database.prepare("UPDATE supplier_applications SET contact_name='', contact_email='', public_email='', public_phone='', website='' WHERE id=?")
      .run(supplier.application_id);
    database.prepare("DELETE FROM inquiries WHERE supplier_id=?").run(id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  response.json({ withdrawn: true });
});

/** Permanently erase a supplier and its application when deletion is requested. */
app.delete("/api/admin/suppliers/:id", requireAdmin, (request, response) => {
  const id = Number(request.params.id);
  const supplier = database.prepare("SELECT application_id FROM suppliers WHERE id=?").get(id);
  if (!supplier) return response.status(404).json({ error: "Supplier record not found." });
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("DELETE FROM suppliers WHERE id=?").run(id);
    database.prepare("DELETE FROM supplier_applications WHERE id=?").run(supplier.application_id);
    database.prepare("DELETE FROM inquiries WHERE supplier_id=?").run(id);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  response.status(204).end();
});

/** Give authenticated support staff access to retained inquiries and honor deletion requests. */
app.get("/api/admin/inquiries", requireAdmin, (_request, response) => {
  const inquiries = database.prepare("SELECT id, name, email, topic, message, created_at AS createdAt FROM inquiries ORDER BY created_at DESC LIMIT 250").all();
  response.set("Cache-Control", "no-store").json({ inquiries });
});
app.delete("/api/admin/inquiries/:id", requireAdmin, (request, response) => {
  const result = database.prepare("DELETE FROM inquiries WHERE id=?").run(Number(request.params.id));
  if (!result.changes) return response.status(404).json({ error: "Inquiry not found." });
  response.status(204).end();
});

/** Serve the HTML application and its assets from the API's same origin. */
app.use("/server", (_request, response) => response.status(404).end());
app.use(express.static(projectRoot, { extensions: ["html"], index: "index.html", dotfiles: "ignore" }));
app.use("/api", (_request, response) => response.status(404).json({ error: "API route not found." }));
app.use((error, _request, response, _next) => {
  console.error("Request failed:", error.message);
  response.status(500).json({ error: "The request could not be completed. Please try again." });
});

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () => {
  console.log(`Enterseed is running at http://${host}:${port}`);
  console.log(`Support email delivery: ${process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.SUPPORT_EMAIL ? "configured" : "not configured"}`);
});
