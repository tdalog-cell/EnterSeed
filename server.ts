import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;
const databasePath = path.resolve(projectRoot, process.env.DATABASE_PATH || 'server/data/enterseed.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

// Initialize SQLite database
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
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    business_name TEXT NOT NULL,
    preferred_language TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS finance_assessments (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    monthly_income INTEGER NOT NULL,
    monthly_expenses INTEGER NOT NULL,
    cash_on_hand INTEGER NOT NULL,
    debt_outstanding INTEGER NOT NULL,
    monthly_debt_payment INTEGER NOT NULL,
    other_assets INTEGER NOT NULL,
    other_liabilities INTEGER NOT NULL,
    tax_standing TEXT NOT NULL CHECK(tax_standing IN ('current', 'needs-filing', 'behind', 'not-registered')),
    consent_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureColumn(table: string, column: string, definition: string) {
  const exists = (database.prepare(`PRAGMA table_info(${table})`).all() as any[]).some((entry) => entry.name === column);
  if (!exists) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('inquiries', 'consent_at', 'TEXT');
ensureColumn('inquiries', 'supplier_id', 'INTEGER');
ensureColumn('readiness_records', 'consent_at', 'TEXT');
ensureColumn('suppliers', 'expires_at', "TEXT NOT NULL DEFAULT '1970-01-01'");

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
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Security headers with Helmet (permissive enough for Dev and Leaflet maps)
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '24kb' }));

// Rate limiters with disabled X-Forwarded-For validation for cloud proxy environments
const rateLimitValidateConfig = {
  xForwardedForHeader: false,
  forwardedHeader: false,
  trustProxy: false,
  default: false
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: rateLimitValidateConfig
});
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: rateLimitValidateConfig
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: rateLimitValidateConfig
});
const placeSearchLimiter = rateLimit({
  windowMs: 1000,
  limit: 2,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  validate: rateLimitValidateConfig
});

app.use('/api', apiLimiter);

// Nominatim queueing
const placeSearchCache = new Map<string, { place: { latitude: number; longitude: number; label: string }; expiresAt: number }>();
let lastNominatimRequestAt = 0;
let nominatimQueue = Promise.resolve();

function requestNominatim(url: string) {
  const request = nominatimQueue.then(async () => {
    const delay = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    lastNominatimRequestAt = Date.now();
    return fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': process.env.NOMINATIM_USER_AGENT || 'EnterseedReact/1.0 (MSME support platform)'
      },
      signal: AbortSignal.timeout(10000)
    });
  });
  nominatimQueue = request.then(() => undefined, () => undefined);
  return request;
}

// Schemas
const inquirySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(254),
  topic: z.string().trim().min(3).max(80),
  message: z.string().trim().min(10).max(3000),
  consent: z.literal(true),
  companyFax: z.string().max(0).optional().default('')
}).strict();

const readinessSchema = z.object({
  stage: z.enum(['unregistered', 'registered']),
  needs: z.array(z.enum(['efiling', 'feasibility', 'suppliers'])).min(1).max(3),
  location: z.string().trim().min(2).max(80),
  consent: z.literal(true)
}).strict();

const supplierApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(100),
  contactEmail: z.string().email().max(254),
  publicEmail: z.union([z.literal(''), z.string().email().max(254)]).default(''),
  publicPhone: z.string().trim().max(40).default(''),
  publishContact: z.boolean(),
  category: z.enum(['raw-materials', 'packaging', 'services', 'marketing']),
  location: z.string().trim().min(2).max(100),
  products: z.string().trim().min(10).max(500),
  website: z.union([z.literal(''), z.string().url().max(300)]).default(''),
  consent: z.literal(true),
  companyFax: z.string().max(0).optional().default('')
}).strict().refine((entry) => !entry.publishContact || Boolean(entry.publicEmail || entry.publicPhone), {
  message: 'Add a public email or phone number, or turn off public contact display.',
  path: ['publicEmail']
});

const supplierMessageSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email().max(254),
  message: z.string().trim().min(10).max(2000),
  consent: z.literal(true)
}).strict();

const approvalSchema = z.object({
  identityConfirmed: z.literal(true),
  businessEvidenceReviewed: z.literal(true),
  contactConfirmed: z.literal(true),
  locationConfirmed: z.literal(true),
  listingConsentConfirmed: z.literal(true),
  reviewNotes: z.string().trim().min(20).max(1000)
}).strict();

const assistantSchema = z.object({
  question: z.string().trim().min(2).max(1200),
  history: z.array(z.object({ role: z.enum(['user', 'model']), text: z.string().max(1200) }).strict()).max(8).default([]),
  language: z.enum(['en', 'fil', 'ceb', 'hil']).default('en')
}).strict();

const financeAssessmentSchema = z.object({
  monthlyIncome: z.number().int().min(0).max(1_000_000_000),
  monthlyExpenses: z.number().int().min(0).max(1_000_000_000),
  cashOnHand: z.number().int().min(0).max(1_000_000_000),
  debtOutstanding: z.number().int().min(0).max(1_000_000_000),
  monthlyDebtPayment: z.number().int().min(0).max(1_000_000_000),
  otherAssets: z.number().int().min(0).max(1_000_000_000),
  otherLiabilities: z.number().int().min(0).max(1_000_000_000),
  taxStanding: z.enum(['current', 'needs-filing', 'behind', 'not-registered']),
  consent: z.literal(true)
}).strict();

const registrationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email().trim().max(254),
  password: z.string().min(12).max(128),
  business: z.string().trim().min(2).max(120),
  agree: z.literal(true)
}).strict();

const loginSchema = z.object({
  email: z.string().email().trim().max(254),
  password: z.string().min(1).max(128)
}).strict();

const languageSchema = z.object({
  language: z.enum(['en', 'fil', 'ceb', 'hil'])
}).strict();

const referenceSources = [
  { label: 'DTI Business Name Registration System', url: 'https://bnrs.dti.gov.ph/', lastLinkChecked: '2026-10-19', reviewNote: 'Official portal; automated access was rate-limited. Confirm current requirements and fees directly.' },
  { label: 'DTI business-name registration FAQ', url: 'https://www.dti.gov.ph/resources/faq/business-name-registration/', lastLinkChecked: '2026-10-19', reviewNote: 'Official DTI page; content could not be independently fetched during this review.' },
  { label: 'Bureau of Internal Revenue', url: 'https://www.bir.gov.ph/', lastLinkChecked: '2026-10-19', reviewNote: 'Official BIR website; verify applicable tax rules, forms, deadlines, and filing options directly.' },
  { label: 'Department of Science and Technology', url: 'https://www.dost.gov.ph/', lastLinkChecked: '2026-10-19', reviewNote: 'Official DOST website; verify current programs and eligibility directly with DOST.' },
  { label: 'South Cotabato Provincial Government services', url: 'https://southcotabato.gov.ph/services/', lastLinkChecked: '2026-10-19', reviewNote: 'Official provincial website; confirm the relevant office and current process directly.' },
  { label: 'Koronadal City Government', url: 'https://koronadal.gov.ph/', lastLinkChecked: '2026-10-19', reviewNote: 'Official city website; permit-specific details were not independently confirmed.' }
];

const offlineAnswers = [
  {
    match: /dti|business name|registration|bnrs|rehistro|pagpaparehistro/i,
    text: 'I can help you get oriented, but I cannot confirm current DTI requirements from this demo. Use the official BNRS portal below to check the latest requirements and fees. Barangay and city or municipal permits are separate LGU processes; ask your municipality which rules apply to your business.',
    fil: 'Makakatulong ako sa pagbibigay ng paunang gabay, pero hindi ko makukumpirma rito ang kasalukuyang mga kinakailangan ng DTI. Tingnan ang opisyal na BNRS portal sa ibaba para sa pinakabagong mga kinakailangan at bayarin. Hiwalay na proseso ng LGU ang mga permit sa barangay, lungsod, o munisipalidad; magtanong sa inyong lokal na tanggapan kung ano ang naaangkop sa negosyo mo.'
  },
  {
    match: /permit|lgu|barangay|municipal|city|pahintulot|munisipalidad|lungsod/i,
    text: 'Permit requirements depend on your business activity and location. Contact your city or municipal business-permit office for its current checklist. The official provincial and Koronadal links below are starting points, not confirmation that a specific permit rule was reviewed.',
    fil: 'Nakadepende sa uri at lokasyon ng negosyo ang mga kinakailangang permit. Makipag-ugnayan sa tanggapan ng permit sa negosyo ng inyong lungsod o munisipalidad para sa kasalukuyang checklist. Panimulang sanggunian lamang ang mga opisyal na link ng lalawigan at Koronadal sa ibaba; hindi ito kumpirmasyon ng partikular na patakaran sa permit.'
  },
  {
    match: /feasibility|land bank|loan|business plan|pag-aaral|pautang|plano ng negosyo/i,
    text: 'A feasibility-study draft can organize the market, operations, startup costs, financial assumptions, and risks. Treat projections as your own assumptions, and ask your Land Bank lending officer for the current loan product checklist. This draft is not a loan approval or lending advice.',
    fil: 'Makakatulong ang burador ng feasibility study sa pag-aayos ng impormasyon tungkol sa merkado, operasyon, panimulang gastos, palagay sa pananalapi, at mga panganib. Ituring na sarili mong palagay ang mga proyeksiyon at hingin sa opisyal ng Land Bank ang kasalukuyang checklist ng pautang. Hindi ito pag-apruba ng pautang o payo sa pagpapautang.'
  },
  {
    match: /supplier|raw material|packaging|local|tagapagtustos|materyales/i,
    text: 'The public supplier directory includes only businesses that opted in and passed Enterseed’s documented review. No supplier is shown until that verification process is complete. Use the supplier-application form to request a review.',
    fil: "Kasama lamang sa pampublikong direktoryo ng supplier ang mga negosyong kusang sumali at pumasa sa pagsusuri ng Enterseed. Walang supplier na ililista hangga't hindi kumpleto ang beripikasyon. Gamitin ang form ng aplikasyon ng supplier para humiling ng pagsusuri."
  }
];

function getOfflineAssistantAnswer(question: string, language: string) {
  const answer = offlineAnswers.find((entry) => entry.match.test(question));
  if (language === 'fil' || language === 'hil' || language === 'ceb') {
    return answer?.fil
      ?? (language === 'hil'
        ? 'Indi ko makumpirma ang sabat halin sa mga sanggunian nga yara sa akon. Tan-awa ang opisyal nga mga link sa idalom ukon kontaka ang suporta sang Enterseed.'
        : language === 'ceb'
        ? 'Dili nako makumpirma ang tubag gikan sa mga reperensiya nga naa nako. Tan-awa ang opisyal nga mga link sa ubos o kontaka ang suporta sa Enterseed.'
        : 'Hindi ko makukumpirma ang sagot gamit ang mga sangguniang mayroon ako. Tingnan ang mga opisyal na link sa ibaba o magpadala ng mensahe sa suporta ng Enterseed.');
  }
  return answer?.text
    ?? 'I can’t verify that answer from the available references. Check the official links below or send a support inquiry.';
}

function parseBody<T>(schema: z.ZodSchema<T>, request: Request, response: Response): T | null {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: 'Please review the required fields.', fields: parsed.error.flatten().fieldErrors });
    return null;
  }
  return parsed.data;
}

function getAssistantReferences(question: string) {
  if (/tax|bir|filing|buwis|buhis/i.test(question)) return [referenceSources[2]];
  if (/dost|technology|innovation|setup program/i.test(question)) return [referenceSources[3]];
  if (/permit|lgu|barangay|municipal|city/i.test(question)) return [referenceSources[4], referenceSources[5]];
  if (/supplier|raw material|packaging/i.test(question)) return [referenceSources[4], referenceSources[5]];
  return [referenceSources[0], referenceSources[1], referenceSources[2], referenceSources[3]];
}

async function createAssistantAnswer(question: string, history: any[] = [], language = 'en') {
  const localReference = offlineAnswers.find((entry) => entry.match.test(question))?.text
    ?? 'No matching local reference is available. Direct the visitor to an official source or human support.';
  const sources = getAssistantReferences(question);
  if (process.env.GEMINI_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are Boss Narra, an informational assistant for MSMEs in South Cotabato. Be cautious and useful, not authoritative. No supplied source pages or source excerpts have been retrieved for this request: links alone are not evidence. Do not state legal, tax, lending, eligibility, filing, deadline, fee, or government-program facts unless explicitly present in the supplied local orientation snippet. Treat that snippet as non-authoritative and potentially outdated. Never invent figures, rules, citations, or source contents; never claim an application was filed or a source was checked. For unsupported questions, state that you cannot verify the answer and direct the user to the exact official links below. Clearly label arithmetic based on user-provided figures as estimates, not professional financial advice. ${language === 'fil' ? 'Respond in Filipino (Tagalog).' : language === 'ceb' ? 'Respond in Cebuano (Bisaya); if you cannot express a detail reliably, say so plainly.' : language === 'hil' ?'Respond in Hiligaynon; if you cannot express a detail reliably, say so plainly.' : 'Respond in English.'}\nLocal orientation only:\n${localReference}\nOfficial verification links (not retrieved evidence): ${sources.map((s) => `${s.label}: ${s.url}`).join('; ')}`
            }]
          },
          contents: [...history.map((entry) => ({ role: entry.role, parts: [{ text: entry.text }] })), { role: 'user', parts: [{ text: question }] }]
        })
      });
      if (!res.ok) throw new Error('Gemini error');
      const payload = await res.json() as any;
      const answer = payload.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim();
      if (answer) return { answer, mode: 'gemini-unverified', sources };
    } catch {
      return { answer: getOfflineAssistantAnswer(question, language), mode: 'offline-fallback', sources };
    }
  }
  return { answer: getOfflineAssistantAnswer(question, language), mode: 'offline', sources };
}

// Password hashing & session auth
const sessionCookieName = 'enterseed_session';
const sessionLifetimeSeconds = 7 * 24 * 60 * 60;

function hashPassword(password: string, salt = crypto.randomBytes(16)): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(derivedKey.length === expected.length && crypto.timingSafeEqual(derivedKey, expected));
    });
  });
}

function readSessionToken(request: Request): string {
  const bearer = request.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (bearer) return bearer[1];
  const cookie = request.headers.cookie?.split(';').map((p) => p.trim())
    .find((p) => p.startsWith(`${sessionCookieName}=`));
  return cookie ? cookie.slice(sessionCookieName.length + 1) : '';
}

function writeSessionCookie(response: Response, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.append('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetimeSeconds}${secure}`);
}

function clearSessionCookie(response: Response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.append('Set-Cookie', `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function createSession(userId: number, response: Response): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000).toISOString().replace('T', ' ').slice(0, 19);
  database.prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt);
  writeSessionCookie(response, token);
  return token;
}

function findAuthenticatedAccount(request: Request, response: Response) {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = database.prepare(`
    SELECT u.id, u.email, u.first_name AS firstName, u.last_name AS lastName,
           u.business_name AS business, u.preferred_language AS preferredLanguage
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).get(tokenHash) as any;
  if (!session) {
    database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
    clearSessionCookie(response);
    return null;
  }
  return session;
}

function requireAuthentication(request: any, response: Response, next: NextFunction) {
  const account = findAuthenticatedAccount(request, response);
  if (!account) return response.status(401).json({ error: 'Please log in to continue.' });
  request.account = account;
  response.set('Cache-Control', 'no-store');
  next();
}

function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_KEY || '';
  const supplied = request.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (!expected || expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    response.status(expected ? 401 : 503).json({ error: expected ? 'Unauthorized.' : 'Admin review is not configured.' });
    return;
  }
  next();
}

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && process.env.SUPPORT_EMAIL)
  });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const data = parseBody(registrationSchema, req, res);
  if (!data) return;
  const email = data.email.toLowerCase();
  if (database.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
  }
  const passwordHash = await hashPassword(data.password);
  try {
    const result = database.prepare(`
      INSERT INTO users (email, password_hash, first_name, last_name, business_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(email, passwordHash, data.firstName, data.lastName, data.business);
    const userId = Number(result.lastInsertRowid);
    const sessionToken = createSession(userId, res);
    res.status(201).set('Cache-Control', 'no-store').json({
      user: { email, firstName: data.firstName, lastName: data.lastName, business: data.business, preferredLanguage: '' },
      needsLanguageSelection: true,
      sessionToken
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed: users.email')) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in instead.' });
    }
    throw error;
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const data = parseBody(loginSchema, req, res);
  if (!data) return;
  const email = data.email.toLowerCase();
  const user = database.prepare(`
    SELECT id, email, password_hash AS passwordHash, first_name AS firstName,
           last_name AS lastName, business_name AS business,
           preferred_language AS preferredLanguage
    FROM users WHERE email = ?
  `).get(email) as any;
  let passwordMatches = false;
  if (user) {
    passwordMatches = await verifyPassword(data.password, user.passwordHash);
  } else {
    await hashPassword(data.password, Buffer.alloc(16, 1));
  }
  if (!user || !passwordMatches) return res.status(401).json({ error: 'Email or password is incorrect.' });
  const sessionToken = createSession(user.id, res);
  res.set('Cache-Control', 'no-store').json({
    user: {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      business: user.business,
      preferredLanguage: user.preferredLanguage
    },
    needsLanguageSelection: !user.preferredLanguage,
    sessionToken
  });
});

app.get('/api/auth/me', requireAuthentication, (req: any, res) => {
  res.json({ user: req.account });
});

app.patch('/api/auth/language', authLimiter, requireAuthentication, (req: any, res) => {
  const data = parseBody(languageSchema, req, res);
  if (!data) return;
  database.prepare('UPDATE users SET preferred_language = ? WHERE id = ?').run(data.language, req.account.id);
  res.json({ preferredLanguage: data.language });
});

app.post('/api/auth/logout', requireAuthentication, (req: any, res) => {
  const tokenHash = crypto.createHash('sha256').update(readSessionToken(req)).digest('hex');
  database.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  clearSessionCookie(res);
  res.status(204).end();
});

app.get('/api/finance/assessment', requireAuthentication, (req: any, res) => {
  const assessment = database.prepare(`
    SELECT monthly_income AS monthlyIncome, monthly_expenses AS monthlyExpenses,
           cash_on_hand AS cashOnHand, debt_outstanding AS debtOutstanding,
           monthly_debt_payment AS monthlyDebtPayment, other_assets AS otherAssets,
           other_liabilities AS otherLiabilities, tax_standing AS taxStanding,
           updated_at AS updatedAt
    FROM finance_assessments WHERE user_id = ?
  `).get(req.account.id);
  res.json({ assessment: assessment || null });
});

app.put('/api/finance/assessment', requireAuthentication, (req: any, res) => {
  const data = parseBody(financeAssessmentSchema, req, res);
  if (!data) return;
  database.prepare(`
    INSERT INTO finance_assessments
      (user_id, monthly_income, monthly_expenses, cash_on_hand, debt_outstanding,
       monthly_debt_payment, other_assets, other_liabilities, tax_standing, consent_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      monthly_income = excluded.monthly_income,
      monthly_expenses = excluded.monthly_expenses,
      cash_on_hand = excluded.cash_on_hand,
      debt_outstanding = excluded.debt_outstanding,
      monthly_debt_payment = excluded.monthly_debt_payment,
      other_assets = excluded.other_assets,
      other_liabilities = excluded.other_liabilities,
      tax_standing = excluded.tax_standing,
      consent_at = excluded.consent_at,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    req.account.id, data.monthlyIncome, data.monthlyExpenses, data.cashOnHand,
    data.debtOutstanding, data.monthlyDebtPayment, data.otherAssets,
    data.otherLiabilities, data.taxStanding, new Date().toISOString()
  );
  res.status(200).set('Cache-Control', 'no-store').json({ saved: true });
});

app.delete('/api/finance/assessment', requireAuthentication, (req: any, res) => {
  database.prepare('DELETE FROM finance_assessments WHERE user_id = ?').run(req.account.id);
  res.status(204).end();
});

app.post('/api/boss-nana', requireAuthentication, submissionLimiter, async (req, res) => {
  const data = parseBody(assistantSchema, req, res);
  if (!data) return;
  const result = await createAssistantAnswer(data.question, data.history, data.language);
  res.set('Cache-Control', 'no-store').json(result);
});

app.post('/api/assistant', submissionLimiter, async (req, res) => {
  const data = parseBody(assistantSchema, req, res);
  if (!data) return;
  const result = await createAssistantAnswer(data.question, data.history, data.language);
  res.set('Cache-Control', 'no-store').json(result);
});

app.get('/api/suppliers', (_req, res) => {
  const suppliers = database.prepare(`
    SELECT id, business_name AS name, category, location, products,
           public_email AS publicEmail, public_phone AS publicPhone, website,
           verified_at AS verifiedAt
    FROM suppliers WHERE status = 'active' AND verified_at <> '' AND expires_at > CURRENT_TIMESTAMP
    ORDER BY business_name COLLATE NOCASE
  `).all();
  res.set('Cache-Control', 'no-store').json({ suppliers });
});

app.get('/api/places/search', placeSearchLimiter, async (req, res) => {
  const parsed = z.string().trim().min(2).max(100).safeParse(req.query.q);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a municipality or city name.' });
  const query = parsed.data.toLowerCase();
  const cached = placeSearchCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return res.json({ place: cached.place, cached: true });
  try {
    const params = new URLSearchParams({ q: `${parsed.data}, SOCCSKSARGEN, Philippines`, format: 'jsonv2', limit: '1', countrycodes: 'ph' });
    const result = await requestNominatim(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!result.ok) return res.status(502).json({ error: 'OpenStreetMap place search is temporarily unavailable.' });
    const [match] = await result.json() as any[];
    if (!match) return res.status(404).json({ error: 'No matching South Cotabato place was found.' });
    const place = { latitude: Number(match.lat), longitude: Number(match.lon), label: match.display_name };
    if (placeSearchCache.size > 500) placeSearchCache.clear();
    placeSearchCache.set(query, { place, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    res.set('Cache-Control', 'public, max-age=3600').json({ place, cached: false });
  } catch {
    res.status(502).json({ error: 'OpenStreetMap place search is temporarily unavailable.' });
  }
});

app.post('/api/readiness', submissionLimiter, (req, res) => {
  const data = parseBody(readinessSchema, req, res);
  if (!data) return;
  const deleteToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(deleteToken).digest('hex');
  database.prepare('INSERT INTO readiness_records (stage, needs_json, location, delete_token_hash) VALUES (?, ?, ?, ?)')
    .run(data.stage, JSON.stringify([...new Set(data.needs)]), data.location, tokenHash);
  res.status(201).json({ received: true, deleteToken, retentionDays: 30 });
});

app.delete('/api/readiness/:deleteToken', submissionLimiter, (req, res) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.deleteToken).digest('hex');
  const result = database.prepare('DELETE FROM readiness_records WHERE delete_token_hash = ?').run(tokenHash);
  if (!result.changes) return res.status(404).json({ error: 'Assessment was not found or has already expired.' });
  res.status(204).end();
});

app.post('/api/inquiries', submissionLimiter, (req, res) => {
  const data = parseBody(inquirySchema, req, res);
  if (!data) return;
  if (data.companyFax) return res.status(202).json({ received: true });
  const result = database.prepare('INSERT INTO inquiries (name, email, topic, message) VALUES (?, ?, ?, ?)')
    .run(data.name, data.email, data.topic, data.message);
  res.status(201).json({ received: true, reference: Number(result.lastInsertRowid), retentionDays: 180 });
});

app.post('/api/supplier-applications', submissionLimiter, (req, res) => {
  const data = parseBody(supplierApplicationSchema, req, res);
  if (!data) return;
  if (data.companyFax) return res.status(202).json({ received: true });
  database.prepare(`
    INSERT INTO supplier_applications
      (business_name, contact_name, contact_email, public_email, public_phone, publish_contact,
       category, location, products, website, consent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.businessName, data.contactName, data.contactEmail, data.publishContact ? data.publicEmail : '',
    data.publishContact ? data.publicPhone : '', data.publishContact ? 1 : 0, data.category,
    data.location, data.products, data.website, new Date().toISOString()
  );
  res.status(201).json({ received: true, status: 'pending_review', retentionDays: 90 });
});

app.post('/api/suppliers/:id/contact', submissionLimiter, (req, res) => {
  const data = parseBody(supplierMessageSchema, req, res);
  if (!data) return;
  const supplier = database.prepare(`
    SELECT s.business_name AS businessName, a.contact_email AS contactEmail
    FROM suppliers s JOIN supplier_applications a ON a.id = s.application_id
    WHERE s.id = ? AND s.status = 'active' AND s.verified_at <> '' AND s.expires_at > CURRENT_TIMESTAMP
  `).get(Number(req.params.id)) as any;
  if (!supplier) return res.status(404).json({ error: 'Reviewed supplier listing not found.' });
  const result = database.prepare('INSERT INTO inquiries (name, email, topic, message, supplier_id) VALUES (?, ?, ?, ?, ?)')
    .run(data.name, data.email, `Supplier introduction: ${supplier.businessName}`, data.message, Number(req.params.id));
  res.status(201).json({ received: true, reference: Number(result.lastInsertRowid), forwarded: false, retentionDays: 180 });
});

// Admin endpoints
app.get('/api/admin/supplier-applications', requireAdmin, (_req, res) => {
  const applications = database.prepare(`
    SELECT id, business_name AS businessName, contact_name AS contactName, contact_email AS contactEmail,
           public_email AS publicEmail, public_phone AS publicPhone, publish_contact AS publishContact,
           category, location, products, website, consent_at AS consentAt, created_at AS createdAt
    FROM supplier_applications WHERE status = 'pending' ORDER BY created_at
  `).all();
  res.set('Cache-Control', 'no-store').json({ applications });
});

app.get('/api/admin/suppliers', requireAdmin, (_req, res) => {
  const suppliers = database.prepare(`
    SELECT id, business_name AS businessName, category, location,
           verified_at AS verifiedAt, expires_at AS expiresAt, status
    FROM suppliers ORDER BY verified_at DESC
  `).all();
  res.set('Cache-Control', 'no-store').json({ suppliers });
});

app.post('/api/admin/supplier-applications/:id/approve', requireAdmin, (req, res) => {
  const checks = parseBody(approvalSchema, req, res);
  if (!checks) return;
  const application = database.prepare("SELECT * FROM supplier_applications WHERE id = ? AND status = 'pending'").get(Number(req.params.id)) as any;
  if (!application) return res.status(404).json({ error: 'Pending supplier application not found.' });
  const verifiedAt = new Date().toISOString();
  let supplierId: number;
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare("UPDATE supplier_applications SET status='approved', review_notes=?, decision_at=? WHERE id=?")
      .run(checks.reviewNotes, verifiedAt, application.id);
    const inserted = database.prepare(`
      INSERT INTO suppliers (application_id, business_name, category, location, products,
        public_email, public_phone, website, consent_at, verified_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+365 days'))
    `).run(application.id, application.business_name, application.category, application.location, application.products,
      application.publish_contact ? application.public_email : '', application.publish_contact ? application.public_phone : '',
      application.website, application.consent_at, verifiedAt);
    supplierId = Number(inserted.lastInsertRowid);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  res.status(201).json({ approved: true, supplierId, verifiedAt });
});

app.post('/api/admin/supplier-applications/:id/reject', requireAdmin, (req, res) => {
  const data = z.object({ reason: z.string().trim().min(10).max(1000) }).safeParse(req.body);
  if (!data.success) return res.status(400).json({ error: 'A review reason of at least 10 characters is required.' });
  const result = database.prepare("UPDATE supplier_applications SET status='rejected', review_notes=?, decision_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'")
    .run(data.data.reason, Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Pending supplier application not found.' });
  res.json({ rejected: true });
});

app.post('/api/admin/suppliers/:id/withdraw', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const supplier = database.prepare("SELECT application_id FROM suppliers WHERE id=? AND status='active'").get(id) as any;
  if (!supplier) return res.status(404).json({ error: 'Active supplier listing not found.' });
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare("UPDATE suppliers SET status='withdrawn', public_email='', public_phone='', website='' WHERE id=?").run(id);
    database.prepare("UPDATE supplier_applications SET contact_name='', contact_email='', public_email='', public_phone='', website='' WHERE id=?")
      .run(supplier.application_id);
    database.prepare('DELETE FROM inquiries WHERE supplier_id=?').run(id);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  res.json({ withdrawn: true });
});

app.delete('/api/admin/suppliers/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const supplier = database.prepare('SELECT application_id FROM suppliers WHERE id=?').get(id) as any;
  if (!supplier) return res.status(404).json({ error: 'Supplier record not found.' });
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM suppliers WHERE id=?').run(id);
    database.prepare('DELETE FROM supplier_applications WHERE id=?').run(supplier.application_id);
    database.prepare('DELETE FROM inquiries WHERE supplier_id=?').run(id);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  res.status(204).end();
});

app.get('/api/admin/inquiries', requireAdmin, (_req, res) => {
  const inquiries = database.prepare('SELECT id, name, email, topic, message, created_at AS createdAt FROM inquiries ORDER BY created_at DESC LIMIT 250').all();
  res.set('Cache-Control', 'no-store').json({ inquiries });
});

app.delete('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
  const result = database.prepare('DELETE FROM inquiries WHERE id=?').run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'Inquiry not found.' });
  res.status(204).end();
});

// Seed sample suppliers if directory is empty
function seedSuppliersIfEmpty() {
  const count = (database.prepare('SELECT COUNT(*) AS count FROM suppliers').get() as any)?.count || 0;
  if (count === 0) {
    const sampleSuppliers = [
      {
        businessName: 'Matutum Agri-Packaging Solutions',
        contactName: 'Elena Ramos',
        contactEmail: 'elena@matutumpackaging.example.ph',
        publicEmail: 'inquiries@matutumpackaging.example.ph',
        publicPhone: '+63 83 228 4101',
        category: 'packaging',
        location: 'Polomolok',
        products: 'Corrugated boxes, eco-friendly banana leaves trays, vacuum pouches for dried fruit',
        website: 'https://matutumpackaging.example.ph'
      },
      {
        businessName: 'South Cotabato Coffee Producers Hub',
        contactName: 'Mateo Dalisay',
        contactEmail: 'mateo@sotcotcoffee.example.ph',
        publicEmail: 'sales@sotcotcoffee.example.ph',
        publicPhone: '+63 917 555 3821',
        category: 'raw-materials',
        location: 'Tupi',
        products: 'Green coffee beans, roasted Arabica and Robusta, processing equipment rentals',
        website: 'https://sotcotcoffee.example.ph'
      },
      {
        businessName: 'Koronadal Digital Marketing & Media',
        contactName: 'Clara Mendoza',
        contactEmail: 'clara@koronadaldigital.example.ph',
        publicEmail: 'support@koronadaldigital.example.ph',
        publicPhone: '+63 83 228 9942',
        category: 'marketing',
        location: 'City of Koronadal',
        products: 'Social media management, DTI brand registration packages, product photography',
        website: 'https://koronadaldigital.example.ph'
      },
      {
        businessName: 'Sebu Artisanal Weaving Cooperative',
        contactName: 'Bae Lilibeth',
        contactEmail: 'lilibeth@lake-sebu-tnalak.example.ph',
        publicEmail: 'order@lake-sebu-tnalak.example.ph',
        publicPhone: '+63 920 441 8892',
        category: 'raw-materials',
        location: 'Lake Sebu',
        products: 'T’nalak abaca textile, natural dye extracts, brassware hardware for bags',
        website: 'https://lake-sebu-tnalak.example.ph'
      },
      {
        businessName: 'Surallah Cold Chain & Logistics',
        contactName: 'Arthur Tan',
        contactEmail: 'arthur@surallahlogistics.example.ph',
        publicEmail: 'dispatch@surallahlogistics.example.ph',
        publicPhone: '+63 83 238 1234',
        category: 'services',
        location: 'Surallah',
        products: 'Temperature-controlled van delivery across SOCCSKSARGEN, pallet storage',
        website: 'https://surallahlogistics.example.ph'
      }
    ];

    for (const s of sampleSuppliers) {
      const now = new Date().toISOString();
      const appResult = database.prepare(`
        INSERT INTO supplier_applications
          (business_name, contact_name, contact_email, public_email, public_phone, publish_contact,
           category, location, products, website, consent_at, status, review_notes, decision_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'approved', 'Verified initial local supplier listing.', ?)
      `).run(s.businessName, s.contactName, s.contactEmail, s.publicEmail, s.publicPhone, s.category, s.location, s.products, s.website, now, now);

      database.prepare(`
        INSERT INTO suppliers (application_id, business_name, category, location, products,
          public_email, public_phone, website, consent_at, verified_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+365 days'))
      `).run(Number(appResult.lastInsertRowid), s.businessName, s.category, s.location, s.products, s.publicEmail, s.publicPhone, s.website, now, now);
    }
  }
}
seedSuppliersIfEmpty();

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const port = Number(process.env.PORT || 3000);
  const host = '0.0.0.0';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(projectRoot, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, host, () => {
    console.log(`Enterseed React server listening on http://${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
