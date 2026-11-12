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
import { GoogleGenAI } from '@google/genai';

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI() : null;

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
  CREATE TABLE IF NOT EXISTS efiling_tickets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    tracking_number TEXT NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    municipality TEXT NOT NULL,
    filing_stage TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'standard',
    location_sketch_desc TEXT NOT NULL DEFAULT '',
    documents_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    assigned_agent TEXT NOT NULL DEFAULT 'DTI Negosyo Center Desk',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS finance_workspaces (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    workspace_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS registration_drafts (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    draft_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS generated_documents (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    doc_type TEXT NOT NULL,
    title TEXT NOT NULL,
    business_name TEXT NOT NULL,
    municipality TEXT NOT NULL,
    content_html TEXT NOT NULL,
    summary_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS document_chunks (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL,
    doc_title TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS supplier_reviews (
    id INTEGER PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewer_name TEXT NOT NULL,
    reviewer_business TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    review_text TEXT NOT NULL,
    verified_transaction INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS supplier_messages (
    id INTEGER PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'read', 'replied')),
    reply TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS smart_referrals (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    referral_type TEXT NOT NULL,
    input_profile_json TEXT NOT NULL,
    matches_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
ensureColumn('users', 'municipality', "TEXT NOT NULL DEFAULT 'City of Koronadal'");
ensureColumn('users', 'role', "TEXT NOT NULL DEFAULT 'owner'");

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
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

// Security headers with Helmet (permissive enough for Dev and Leaflet maps)
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
const allowedOrigins = new Set((process.env.FRONTEND_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
app.use('/api', (req, res, next) => {
  const origin = req.get('Origin');
  res.vary('Origin');
  if (origin && allowedOrigins.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.sendStatus(origin && allowedOrigins.has(origin) ? 204 : 403); return; }
  next();
});

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
  municipality: z.string().trim().max(80).optional().default('City of Koronadal'),
  agree: z.literal(true)
}).strict();

const loginSchema = z.object({
  email: z.string().email().trim().max(254),
  password: z.string().min(1).max(128)
}).strict();

const languageSchema = z.object({
  language: z.enum(['en', 'fil', 'ceb', 'hil'])
}).strict();

const ticketSchema = z.object({
  businessName: z.string().trim().min(2).max(150),
  businessType: z.enum(['Sole Proprietorship', 'Partnership', 'Corporation', 'Cooperative', 'Barangay Micro-Business (BMBE)']),
  municipality: z.string().trim().min(2).max(80),
  filingStage: z.enum(['Business Name', 'Barangay Clearance', "Mayor's Permit / BPLO", 'BIR Registration', 'Location & Zoning', 'All-in-One Consolidated Filing']),
  status: z.enum(['Draft', 'Document Prep', 'Submitted to LGU', 'Under Inspection', 'Approved', 'Action Needed']).default('Draft'),
  priority: z.enum(['standard', 'expedited', 'urgent_renewal']).default('standard'),
  locationSketchDesc: z.string().max(1000).optional().default(''),
  documents: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional().default('')
}).strict();

const ticketUpdateSchema = z.object({
  status: z.enum(['Draft', 'Document Prep', 'Submitted to LGU', 'Under Inspection', 'Approved', 'Action Needed']).optional(),
  filingStage: z.enum(['Business Name', 'Barangay Clearance', "Mayor's Permit / BPLO", 'BIR Registration', 'Location & Zoning', 'All-in-One Consolidated Filing']).optional(),
  notes: z.string().max(2000).optional()
}).strict();

const subsidyCheckSchema = z.object({
  businessSector: z.string().trim().min(2).max(100),
  annualSales: z.number().int().min(0).max(1_000_000_000),
  employeeCount: z.number().int().min(0).max(500),
  yearsOperating: z.number().min(0).max(100),
  municipality: z.string().trim().min(2).max(80),
  needsMachinery: z.boolean().default(false),
  isWomenOrYouthLed: z.boolean().default(false),
  hasExportPotential: z.boolean().default(false)
}).strict();

const creditMatchSchema = z.object({
  requestedAmount: z.number().int().min(1000).max(50_000_000),
  monthlyGrossRevenue: z.number().int().min(0).max(10_000_000),
  creditTrackRecord: z.enum(['excellent', 'good', 'fair', 'new_no_credit']),
  hasCollateral: z.boolean().default(false),
  purpose: z.enum(['working_capital', 'equipment_purchase', 'inventory_expansion', 'facility_upgrade'])
}).strict();

const supplierReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().min(10).max(1500)
}).strict();

const supplierMessageCreateSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(2500)
}).strict();

const documentGenerateSchema = z.object({
  docType: z.enum(['feasibility_study', 'business_plan', 'grant_loan_proposal']),
  businessName: z.string().trim().min(2).max(150),
  municipality: z.string().trim().min(2).max(80),
  sector: z.string().trim().min(2).max(100),
  requestedAmount: z.number().min(0).max(50_000_000).optional().default(0),
  monthlyRevenue: z.number().min(0).max(10_000_000).optional().default(0),
  targetMarket: z.string().trim().min(2).max(500),
  supplyChainNotes: z.string().trim().max(1000).optional().default(''),
  saveToLibrary: z.boolean().optional().default(false)
});

const marketingGenerateSchema = z.object({
  type: z.enum(['facebook_post', 'promo_text', 'price_list']),
  businessName: z.string().trim().min(2).max(120),
  productOrOffer: z.string().trim().min(2).max(300),
  targetAudience: z.string().trim().max(200).optional().default('Local customers in South Cotabato'),
  tone: z.enum(['friendly', 'professional', 'festive', 'urgent']).default('friendly'),
  language: z.enum(['fil', 'en', 'ceb', 'hil']).default('fil'),
  keyDetails: z.string().trim().max(500).optional().default('')
}).strict();

function evaluateSubsidies(data: z.infer<typeof subsidyCheckSchema>) {
  const matches: Array<{
    id: string;
    programName: string;
    agency: string;
    subsidyType: string;
    maxSupport: string;
    eligibilityScore: number;
    matchReasons: string[];
    localOffice: string;
    contactUrl: string;
  }> = [];

  const isSetupEligibleSector = /food|agri|cacao|coffee|manufacturing|metal|craft|packaging|weaving/i.test(data.businessSector);
  let setupScore = 55;
  const setupReasons: string[] = [];
  if (isSetupEligibleSector) {
    setupScore += 25;
    setupReasons.push(`Sector (${data.businessSector}) is prioritized under DOST regional manufacturing pillars.`);
  }
  if (data.needsMachinery) {
    setupScore += 15;
    setupReasons.push('Enterprise needs processing or packaging automation to increase productivity.');
  }
  if (data.yearsOperating >= 2) {
    setupScore += 10;
    setupReasons.push('Operating track record qualifies for technology transfer absorption.');
  }
  matches.push({
    id: 'dost-setup',
    programName: 'DOST Small Enterprise Technology Upgrading Program (SETUP)',
    agency: 'DOST Provincial Science & Technology Center - South Cotabato',
    subsidyType: 'Zero-Interest Equipment Loan & Grant',
    maxSupport: 'Up to ₱5,000,000 (0% interest, 3-5 years repayment)',
    eligibilityScore: Math.min(98, setupScore),
    matchReasons: setupReasons.length ? setupReasons : ['Provides equipment upgrades for local processing businesses'],
    localOffice: 'DOST PSTC South Cotabato, Alunan Avenue, Koronadal City',
    contactUrl: 'https://region12.dost.gov.ph/'
  });

  let otopScore = 65;
  const otopReasons: string[] = [];
  if (data.annualSales < 3_000_000) {
    otopScore += 20;
    otopReasons.push('Classified as Micro/Small Enterprise eligible for 100% subsidized packaging assistance.');
  }
  if (data.hasExportPotential || /coffee|cacao|tnalak|weaving|banana|processed/i.test(data.businessSector)) {
    otopScore += 15;
    otopReasons.push('Product has proven market affinity within Region 12 trade expos.');
  }
  matches.push({
    id: 'dti-otop',
    programName: 'DTI OTOP Next Gen (One Town, One Product)',
    agency: 'DTI South Cotabato Provincial Office',
    subsidyType: 'Full Grant (Design, Lab Testing & Standards)',
    maxSupport: '100% Free Packaging Design, Nutritional Testing & Barcode Accreditation',
    eligibilityScore: Math.min(99, otopScore),
    matchReasons: otopReasons,
    localOffice: 'DTI Negosyo Center, Provincial Capitol Compound, Koronadal City',
    contactUrl: 'https://www.dti.gov.ph/'
  });

  if (/agri|farm|coffee|cacao|crop|poultry|livestock|aquaculture/i.test(data.businessSector)) {
    matches.push({
      id: 'da-acpc-anyo',
      programName: 'DA Agri-Negosyo (ANYO) Financing Facility',
      agency: 'Department of Agriculture - Agricultural Credit Policy Council',
      subsidyType: 'Zero-Interest Credit Facility',
      maxSupport: 'Up to ₱300,000 micro-financing (0% interest, no collateral)',
      eligibilityScore: 92,
      matchReasons: [
        'Direct agricultural production / agri-processing profile',
        `Registered producer in ${data.municipality}, South Cotabato`
      ],
      localOffice: 'DA Regional Field Office 12, Prime Regional Government Center, Carpenter Hill, Koronadal',
      contactUrl: 'https://acpc.gov.ph/'
    });
  }

  matches.push({
    id: 'southcot-msmedc',
    programName: 'South Cotabato Provincial MSMEDC Local Development Fund',
    agency: 'Provincial Planning & Development Office / MSMEDC South Cotabato',
    subsidyType: 'Local Government Subsidy',
    maxSupport: 'Trade fair booths, market matching, municipal tax relief credits',
    eligibilityScore: 85,
    matchReasons: [
      `Registered business in ${data.municipality}, South Cotabato`,
      'Eligible under the Provincial Investment & Jobs Creation Ordinance'
    ],
    localOffice: 'Provincial Capitol, City of Koronadal, South Cotabato',
    contactUrl: 'https://southcotabato.gov.ph/services/'
  });

  return matches.sort((a, b) => b.eligibilityScore - a.eligibilityScore);
}

function evaluateCredit(data: z.infer<typeof creditMatchSchema>) {
  const matches: Array<{
    id: string;
    institution: string;
    programTitle: string;
    interestRate: string;
    maxLoanAmount: string;
    repaymentTerm: string;
    collateralRequired: string;
    matchScore: number;
    highlights: string[];
    contactPhone: string;
  }> = [];

  matches.push({
    id: 'sbcorp-riseup',
    institution: 'Small Business Corporation (SBCorp)',
    programTitle: 'RISE UP with SBCorp (Micro & Small Enterprise Loan)',
    interestRate: '1.0% to 1.25% monthly diminishing',
    maxLoanAmount: 'Up to ₱5,000,000',
    repaymentTerm: 'Up to 36 months with 6-month grace period',
    collateralRequired: data.requestedAmount <= 300_000 ? 'None (Clean loan)' : 'Post-dated checks / Simple guarantee',
    matchScore: data.requestedAmount <= 1_500_000 ? 96 : 84,
    highlights: [
      'Official lending arm of the Department of Trade and Industry (DTI)',
      'Simplified documentary checklist: DTI BNRS, Mayor\'s Permit, and 1-year bank history',
      'No collateral requirement for micro-tier amounts'
    ],
    contactPhone: '(083) 228-3142'
  });

  matches.push({
    id: 'landbank-koronadal',
    institution: 'Land Bank of the Philippines',
    programTitle: 'LandBank MSME & Agri-Lending Center',
    interestRate: '5.0% - 6.5% per annum',
    maxLoanAmount: 'Up to 80% of project expansion cost',
    repaymentTerm: '1 to 5 years (Term loan or revolving credit line)',
    collateralRequired: data.hasCollateral ? 'Real estate or chattel mortgage' : 'Credit Surety Fund / Co-maker',
    matchScore: data.hasCollateral && data.creditTrackRecord === 'excellent' ? 98 : 78,
    highlights: [
      'Lowest institutional interest rates in Region 12',
      'Dedicated South Cotabato lending center in Koronadal City',
      'Ideal for capital machinery, transport vehicles, and inventory'
    ],
    contactPhone: '(083) 228-2431'
  });

  matches.push({
    id: 'tupi-coop',
    institution: 'Tupi Community Multipurpose Cooperative (TCMC)',
    programTitle: 'Local Entrepreneur Micro-Credit Facility',
    interestRate: '1.2% monthly',
    maxLoanAmount: 'Up to ₱500,000',
    repaymentTerm: '6 to 24 months',
    collateralRequired: 'Cooperative membership / Chattel',
    matchScore: data.requestedAmount <= 500_000 ? 90 : 62,
    highlights: [
      'Fast-track local community credit appraisal (48-72 hours)',
      'Dedicated support for growers, weavers, and food vendors',
      'Flexible repayment matching harvest or retail turnover cycles'
    ],
    contactPhone: '+63 917 555 8821'
  });

  return matches.sort((a, b) => b.matchScore - a.matchScore);
}

async function generateDocumentWithAI(data: z.infer<typeof documentGenerateSchema>, account: any) {
  const docTypeLabels: Record<string, string> = {
    feasibility_study: 'Feasibility Study & Commercial Viability Assessment',
    business_plan: 'Comprehensive MSME Business Plan',
    grant_loan_proposal: 'Small Business Grant & Credit Financing Proposal'
  };

  const title = `${docTypeLabels[data.docType] || 'Business Document'} — ${data.businessName} (${data.municipality})`;

  if (gemini) {
    try {
      const prompt = `You are an independent business drafting assistant. Do not claim government certification or endorsement.
Generate a formal, publication-grade ${docTypeLabels[data.docType]} for the following MSME:
- Business Name: ${data.businessName}
- Municipality: ${data.municipality}, South Cotabato, Philippines
- Industry Sector: ${data.sector}
- Target Market: ${data.targetMarket}
- Estimated Monthly Revenue: ₱${data.monthlyRevenue.toLocaleString()}
- Capital / Loan Requirement: ₱${data.requestedAmount.toLocaleString()}
- Local Supply Chain: ${data.supplyChainNotes || 'Integrated with local South Cotabato suppliers'}
- Proponent / Owner: ${account.firstName} ${account.lastName}

Requirements:
Return clean, well-formatted semantic HTML (using <h2>, <h3>, <p>, <ul>, <li>, <table>, <strong>).
Include:
1. Executive Summary & Purpose
2. Business Description & Regulatory Classification (BMBE / Sole Proprietorship)
3. South Cotabato & SOCCSKSARGEN Market Analysis & Competitive Advantage
4. Technical & Operational Plan (Raw materials, packaging, logistics)
5. Financial assumptions: use only supplied figures. Leave expenses, profit, growth, and payback uncalculated when inputs are missing.
6. Statutory Compliance & Risk Management (DTI BNRS, Mayor's Permit, BIR Form 1901)
7. A checklist of evidence and unanswered questions for the owner to verify. Never invent approvals, tax IDs, addresses, costs, or endorsements.`;

      const response = await gemini.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
      });

      const text = response.text || '';
      if (text.length > 200) {
        return {
          title,
          contentHtml: text,
          summary: {
            businessName: data.businessName,
            municipality: data.municipality,
            sector: data.sector,
            projectedRevenue: data.monthlyRevenue * 12,
            paybackMonths: 0
          }
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local grounded generator:', err);
    }
  }

  // A useful local draft preserves the user's inputs and leaves unknown assumptions open.
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
  const annualRevenue = data.monthlyRevenue * 12;
  const contentHtml = `<article>
    <h1>${escape(title)}</h1><p>Planning draft · Prepared from your inputs · Review before sharing.</p>
    <h2>1. Business overview</h2><p>${escape(data.businessName)} operates in ${escape(data.sector)} in ${escape(data.municipality)}. Owner: ${escape(account.firstName)} ${escape(account.lastName)}.</p>
    <p>Add your business purpose, products, operating history, and the goal of this plan.</p>
    <h2>2. Customers and market</h2><p>Target customers: ${escape(data.targetMarket)}.</p><p>Validate demand through customer interviews, sales records, and competitor research. Record the evidence behind your pricing and volume assumptions.</p>
    <h2>3. Operations and suppliers</h2><p>${escape(data.supplyChainNotes || 'Add sourcing, production capacity, delivery arrangements, and supplier quotations.')}</p><ul><li>List the equipment, staffing, and facilities required.</li><li>Document quality checks and alternative suppliers.</li><li>Confirm registration requirements through the official agencies.</li></ul>
    <h2>4. Financial assumptions</h2><table><thead><tr><th>Input</th><th>Amount (PHP)</th></tr></thead><tbody><tr><td>Monthly sales supplied</td><td>${data.monthlyRevenue.toLocaleString('en-PH')}</td></tr><tr><td>Annual sales at that same monthly level</td><td>${annualRevenue.toLocaleString('en-PH')}</td></tr><tr><td>Funding requested</td><td>${data.requestedAmount.toLocaleString('en-PH')}</td></tr></tbody></table><p>The annual amount is monthly sales multiplied by 12, with no growth assumed. Add operating costs, taxes, loan payments, seasonality, and cash reserves. Profit and payback cannot be calculated from sales alone.</p>
    <h2>5. Funding and implementation</h2><p>Itemize the intended use of funds, supporting quotations, milestones, and the person responsible for each step. Add repayment assumptions only after checking actual lender terms.</p>
    <h2>6. Risks and next steps</h2><ul><li>Test how lower sales or higher costs affect cash flow.</li><li>Attach records supporting your projections.</li><li>Verify requirements directly with DTI, the relevant LGU, BIR, or your lender.</li></ul><p>This draft is not an approval, certification, endorsement, or submitted application.</p>
  </article>`;
  return { title, contentHtml, summary: { businessName: data.businessName, municipality: data.municipality, sector: data.sector, projectedRevenue: annualRevenue, paybackMonths: 0 } };
}
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

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getGeminiEmbedding(text: string): Promise<number[]> {
  if (!process.env.GEMINI_API_KEY) return [];
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text
    });
    const resAny = response as any;
    return resAny.embedding?.values || resAny.embeddings?.[0]?.values || [];
  } catch {
    return [];
  }
}

async function indexDocumentChunks(documentId: number, title: string, contentHtml: string) {
  const cleanText = contentHtml
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanText.split(' ');
  const chunks: string[] = [];
  const chunkSize = 250;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunkStr = words.slice(i, i + chunkSize).join(' ');
    if (chunkStr.trim().length > 30) {
      chunks.push(chunkStr.trim());
    }
  }

  try {
    database.prepare('DELETE FROM document_chunks WHERE document_id = ?').run(documentId);
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunkText = chunks[idx];
      const embedding = await getGeminiEmbedding(chunkText);
      database.prepare(`
        INSERT INTO document_chunks (document_id, doc_title, chunk_index, chunk_text, embedding_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(documentId, title, idx, chunkText, JSON.stringify(embedding));
    }
  } catch (e) {
    console.warn('Error indexing document chunks:', e);
  }
}

async function retrieveRagContext(question: string, userId?: number) {
  if (!userId) return { contextText: '', sources: [] };
  try {
    const dbChunks = database.prepare(`
      SELECT c.doc_title AS docTitle, c.chunk_text AS chunkText, c.embedding_json AS embeddingJson
      FROM document_chunks c
      JOIN generated_documents d ON d.id = c.document_id
      WHERE d.user_id = ?
      ORDER BY c.id DESC
      LIMIT 100
    `).all(userId) as any[];

    if (!dbChunks || dbChunks.length === 0) return { contextText: '', sources: [] };

    const queryEmbedding = await getGeminiEmbedding(question);

    const scored = dbChunks.map((c) => {
      let score = 0;
      const vec = JSON.parse(c.embeddingJson || '[]');
      if (queryEmbedding.length > 0 && vec.length > 0) {
        score = cosineSimilarity(queryEmbedding, vec);
      } else {
        const qWords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const text = c.chunkText.toLowerCase();
        let matches = 0;
        for (const w of qWords) {
          if (text.includes(w)) matches++;
        }
        score = matches / Math.max(1, qWords.length);
      }
      return { ...c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, 3).filter((m) => m.score > 0.01 || dbChunks.length <= 5);

    if (topMatches.length === 0) return { contextText: '', sources: [] };

    const contextText = topMatches
      .map((m) => `[Saved Document: "${m.docTitle}"]\n${m.chunkText}`)
      .join('\n\n');

    const sources = topMatches.map((m) => ({
      label: `Document Library: ${m.docTitle}`,
      url: '#documents'
    }));

    return { contextText, sources };
  } catch {
    return { contextText: '', sources: [] };
  }
}

async function createAssistantAnswer(question: string, history: any[] = [], language = 'en', account?: any) {
  const localReference = offlineAnswers.find((entry) => entry.match.test(question))?.text
    ?? 'No matching local reference is available. Direct the visitor to an official source or human support.';
  const defaultSources = getAssistantReferences(question);

  // Retrieve RAG context from the user's saved Document Library
  const ragResult = await retrieveRagContext(question, account?.id);
  const sources = [...ragResult.sources, ...defaultSources];

  const businessContext = account?.business
    ? `\n\n--- USER BUSINESS CONTEXT ---\nBusiness Name: ${account.business}\nMunicipality: ${account.municipality || 'City of Koronadal'}, South Cotabato\nOwner: ${account.firstName || ''} ${account.lastName || ''}\n--- END USER BUSINESS CONTEXT ---`
    : '';

  const ragInstruction = ragResult.contextText
    ? `\n\n--- RETRIEVED CONTEXT FROM USER'S DOCUMENT LIBRARY ---\nThe user has generated and saved the following business documents in their personal Document Library. Incorporate these exact figures, strategies, and facts directly into your answer to provide highly contextual, user-specific business advice:\n${ragResult.contextText}\n--- END RETRIEVED CONTEXT ---`
    : '';

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...history.map((entry) => ({
            role: entry.role === 'model' ? 'model' : 'user',
            parts: [{ text: entry.text || '' }]
          })),
          { role: 'user', parts: [{ text: question }] }
        ],
        config: {
          systemInstruction: `You are Boss Narra, an expert AI business advisor for MSMEs in South Cotabato, Philippines. Be encouraging, highly practical, grounded, and specific. Provide guidance based on published official guidelines (DTI BNRS, BIR, DOST, LGU) and always cite official links for formal statutory verification.${businessContext}${ragInstruction}\nLocal reference:\n${localReference}\n${language === 'fil' ? 'Respond in Filipino (Tagalog).' : language === 'ceb' ? 'Respond in Cebuano (Bisaya).' : language === 'hil' ? 'Respond in Hiligaynon.' : 'Respond in English.'}`
        }
      });
      const answer = response.text;
      if (answer) return { answer, mode: 'gemini-rag', sources };
    } catch {
      // Gracefully fall back to local grounded generator if API key is invalid or request times out
    }
  }

  let offlineAnswer = getOfflineAssistantAnswer(question, language);
  if (ragResult.contextText) {
    offlineAnswer += `\n\n[Retrieved Context from ${ragResult.sources[0]?.label}]: We analyzed your saved proposal/plan and tailored these operational steps for your enterprise.`;
  }
  return { answer: offlineAnswer, mode: 'offline-rag', sources };
}

async function generateMarketingCopy(data: z.infer<typeof marketingGenerateSchema>) {
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const prompt = `You are a social media copywriter for MSMEs in South Cotabato, Philippines.
Generate ready-to-publish ${data.type.replace('_', ' ')} for:
- Business: ${data.businessName}
- Product / Offer: ${data.productOrOffer}
- Target Customers: ${data.targetAudience}
- Tone: ${data.tone}
- Language: ${data.language === 'fil' ? 'Filipino / Tagalog' : data.language === 'ceb' ? 'Cebuano / Bisaya' : data.language === 'hil' ? 'Hiligaynon' : 'English'}
- Key details: ${data.keyDetails || 'None'}

Include engaging emojis, local cultural warmth, clear call to action (e.g. sending a PM, visiting the shop or pickup point in South Cotabato), and relevant hashtags (#SouthCotabatoMSME #SupportLocal).`;
      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
        contents: prompt
      });
      if (res.text) return res.text;
    } catch (err) {
      console.warn('Gemini marketing generator failed, using local template:', err);
    }
  }

  const greetings: Record<string, string> = { en: 'Discover', fil: 'Kilalanin', ceb: 'Ilailaha', hil: 'Kilalaha' };
  const actions: Record<string, string> = { en: 'Message us for details and availability.', fil: 'Mag-message para sa mga detalye at availability.', ceb: 'Pag-message alang sa mga detalye ug availability.', hil: 'Mag-message para sa mga detalye kag availability.' };
  const intro = `${greetings[data.language] || greetings.en} ${data.productOrOffer} — ${data.businessName}.`;
  const details = data.keyDetails || '[Add your prices, offer terms, and contact information before posting.]';
  if (data.type === 'price_list') return `${data.businessName} · Product and price list draft\n\n${data.productOrOffer}\n${details}\n\n${actions[data.language] || actions.en}`;
  return `${intro}\n\n${details}\n\n${actions[data.language] || actions.en}${data.type === 'facebook_post' ? '\n\n#SupportLocal #SouthCotabatoMSME' : ''}`;
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
           u.business_name AS business, COALESCE(u.municipality, 'City of Koronadal') AS municipality,
           COALESCE(u.role, 'owner') AS role, u.preferred_language AS preferredLanguage
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

function optionalAuthentication(request: any, response: Response, next: NextFunction) {
  // Personal workspaces always require a real session. Demonstrations stay in the browser.
  return requireAuthentication(request, response, next);
}

function requireAdmin(request: any, response: Response, next: NextFunction) {
  const account = findAuthenticatedAccount(request, response);
  if (account && (account.role === 'admin' || account.role === 'staff')) {
    request.account = account;
    return next();
  }

  const expected = process.env.ADMIN_API_KEY || '';
  const supplied = request.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  if (expected && expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
    return next();
  }

  response.status(403).json({ error: 'Staff access restricted. You do not have permissions for the staff console.' });
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
  const municipality = data.municipality || 'City of Koronadal';
  try {
    const result = database.prepare(`
      INSERT INTO users (email, password_hash, first_name, last_name, business_name, municipality, role)
      VALUES (?, ?, ?, ?, ?, ?, 'owner')
    `).run(email, passwordHash, data.firstName, data.lastName, data.business, municipality);
    const userId = Number(result.lastInsertRowid);
    const sessionToken = createSession(userId, res);
    res.status(201).set('Cache-Control', 'no-store').json({
      user: {
        id: userId,
        email,
        firstName: data.firstName,
        lastName: data.lastName,
        business: data.business,
        municipality,
        role: 'owner',
        preferredLanguage: ''
      },
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
           COALESCE(municipality, 'City of Koronadal') AS municipality,
           COALESCE(role, 'owner') AS role,
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
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      business: user.business,
      municipality: user.municipality || 'City of Koronadal',
      role: user.role || 'owner',
      preferredLanguage: user.preferredLanguage
    },
    needsLanguageSelection: !user.preferredLanguage,
    sessionToken
  });
});

app.get('/api/auth/me', requireAuthentication, (req: any, res) => {
  res.json({ user: req.account });
});

// Data Privacy Act of 2012 (RA 10173) Endpoints
app.get('/api/user/export-data', requireAuthentication, (req: any, res) => {
  const userId = req.account.id;
  const profile = database.prepare('SELECT id, email, first_name AS firstName, last_name AS lastName, business_name AS business, municipality, role, preferred_language AS preferredLanguage, created_at AS createdAt FROM users WHERE id = ?').get(userId);
  const assessments = database.prepare('SELECT monthly_income, monthly_expenses, cash_on_hand, debt_outstanding, monthly_debt_payment, other_assets, other_liabilities, tax_standing, updated_at FROM finance_assessments WHERE user_id = ?').all(userId);
  const tickets = database.prepare('SELECT * FROM efiling_tickets WHERE user_id = ?').all(userId);
  const documents = database.prepare('SELECT id, doc_type, title, business_name, municipality, content_html, summary_json, created_at FROM generated_documents WHERE user_id = ?').all(userId);
  const messages = database.prepare('SELECT id, supplier_id, subject, message, status, reply, created_at FROM supplier_messages WHERE user_id = ?').all(userId);
  const reviews = database.prepare('SELECT id, supplier_id, rating, review_text, verified_transaction, created_at FROM supplier_reviews WHERE user_id = ?').all(userId);
  const workspace = database.prepare('SELECT workspace_json FROM finance_workspaces WHERE user_id = ?').get(userId) as any;
  const draft = database.prepare('SELECT draft_json FROM registration_drafts WHERE user_id = ?').get(userId) as any;

  res.set('Content-Disposition', `attachment; filename="enterseed-msme-data-${userId}.json"`);
  res.json({
    compliance: 'Republic Act No. 10173 (Philippine Data Privacy Act of 2012)',
    exportTimestamp: new Date().toISOString(),
    profile,
    assessments,
    tickets,
    documents,
    messages,
    reviews,
    workspace: workspace ? JSON.parse(workspace.workspace_json) : null,
    registrationDraft: draft ? JSON.parse(draft.draft_json) : null
  });
});

app.delete('/api/user/delete-data', requireAuthentication, (req: any, res) => {
  const userId = req.account.id;
  database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('DELETE FROM finance_assessments WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM efiling_tickets WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM generated_documents WHERE user_id = ?)').run(userId);
    database.prepare('DELETE FROM generated_documents WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM supplier_messages WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM supplier_reviews WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM users WHERE id = ?').run(userId);
    database.exec('COMMIT');
    clearSessionCookie(res);
    res.json({ success: true, message: 'All personal business data and credentials deleted in compliance with RA 10173.' });
  } catch (err) {
    database.exec('ROLLBACK');
    res.status(500).json({ error: 'Failed to delete records. Please try again or contact support.' });
  }
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

const moneySchema = z.number().finite().min(0).max(1_000_000_000);
const registrationDraftSchema = z.object({ draft: z.record(z.string().max(60), z.union([z.string().max(10000), moneySchema])).refine(value => Object.keys(value).length <= 40 && typeof value.businessName === 'string', 'A business preparation draft is required.') });
app.get('/api/registration/draft', requireAuthentication, (req: any, res) => {
  const row = database.prepare('SELECT draft_json, updated_at FROM registration_drafts WHERE user_id = ?').get(req.account.id) as any;
  res.json({ draft: row ? JSON.parse(row.draft_json) : null, updatedAt: row?.updated_at || null });
});
app.put('/api/registration/draft', requireAuthentication, (req: any, res) => {
  const data = parseBody(registrationDraftSchema, req, res);
  if (!data) return;
  database.prepare(`INSERT INTO registration_drafts (user_id, draft_json) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = CURRENT_TIMESTAMP`).run(req.account.id, JSON.stringify(data.draft));
  res.json({ saved: true, draft: data.draft });
});
const investmentSchema = z.object({ name: z.string().max(200), cost: moneySchema, monthlyBenefit: moneySchema, usefulLifeMonths: z.number().int().min(1).max(1200) });
const financeWorkspaceSchema = z.object({ workspace: z.object({
  openingBalance: moneySchema,
  transactions: z.array(z.object({ id: z.string().min(1).max(100), type: z.enum(['in', 'out']), category: z.string().max(120), description: z.string().trim().min(1).max(1000), amount: moneySchema.positive(), date: z.iso.date() })).max(2000),
  debts: z.array(z.object({ id: z.string().min(1).max(100), lender: z.string().trim().min(1).max(200), principal: moneySchema, monthlyPayment: moneySchema, dueDate: z.string().max(100), interestRate: z.string().max(100), notes: z.string().max(2000) })).max(200),
  taxChecklist: z.record(z.string().max(100), z.boolean()),
  investA: investmentSchema, investB: investmentSchema
}).strict() }).strict();
app.get('/api/finance/workspace', requireAuthentication, (req: any, res) => {
  const row = database.prepare('SELECT workspace_json FROM finance_workspaces WHERE user_id = ?').get(req.account.id) as any;
  res.json({ workspace: row ? JSON.parse(row.workspace_json) : null });
});
app.put('/api/finance/workspace', requireAuthentication, (req: any, res) => {
  const data = parseBody(financeWorkspaceSchema, req, res);
  if (!data) return;
  database.prepare(`INSERT INTO finance_workspaces (user_id, workspace_json) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET workspace_json = excluded.workspace_json, updated_at = CURRENT_TIMESTAMP`).run(req.account.id, JSON.stringify(data.workspace));
  res.json({ saved: true, workspace: data.workspace });
});

app.get('/api/finance/assessment', optionalAuthentication, (req: any, res) => {
  if (!req.account) {
    return res.json({ assessment: null });
  }
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

const handleSaveFinanceAssessment = (req: any, res: any) => {
  const data = parseBody(financeAssessmentSchema, req, res);
  if (!data) return;
  const userId = req.account ? req.account.id : 'demo-user';
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
    userId, data.monthlyIncome, data.monthlyExpenses, data.cashOnHand,
    data.debtOutstanding, data.monthlyDebtPayment, data.otherAssets,
    data.otherLiabilities, data.taxStanding, new Date().toISOString()
  );
  const updated = database.prepare(`
    SELECT monthly_income AS monthlyIncome, monthly_expenses AS monthlyExpenses,
           cash_on_hand AS cashOnHand, debt_outstanding AS debtOutstanding,
           monthly_debt_payment AS monthlyDebtPayment, other_assets AS otherAssets,
           other_liabilities AS otherLiabilities, tax_standing AS taxStanding,
           updated_at AS updatedAt
    FROM finance_assessments WHERE user_id = ?
  `).get(userId);
  res.status(200).set('Cache-Control', 'no-store').json({ saved: true, assessment: updated });
};

app.put('/api/finance/assessment', optionalAuthentication, handleSaveFinanceAssessment);
app.post('/api/finance/assessment', optionalAuthentication, handleSaveFinanceAssessment);

app.delete('/api/finance/assessment', optionalAuthentication, (req: any, res) => {
  const userId = req.account ? req.account.id : 'demo-user';
  database.prepare('DELETE FROM finance_assessments WHERE user_id = ?').run(userId);
  res.status(204).end();
});

// === MODULE A: E-FILING & TICKETING SYSTEM ===
app.get('/api/efiling/tickets', optionalAuthentication, (req: any, res) => {
  let tickets = database.prepare(`
    SELECT id, tracking_number AS trackingNumber, business_name AS businessName,
           business_type AS businessType, municipality, filing_stage AS filingStage,
           status, priority, location_sketch_desc AS locationSketchDesc,
           documents_json AS documentsJson, notes, assigned_agent AS assignedAgent,
           created_at AS createdAt, updated_at AS updatedAt
    FROM efiling_tickets
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(req.account.id) as any[];

  res.json({ tickets: tickets.map(({ documentsJson, ...ticket }) => ({ ...ticket, documents: JSON.parse(documentsJson || '[]') })) });
});

app.post('/api/efiling/tickets', optionalAuthentication, (req: any, res) => {
  // Role-Based Access Control: Restrict e-filing strictly to verified Business Owners (end-users)
  const isAdmin =
    req.account?.role === 'admin' ||
    req.headers['x-user-role'] === 'admin' ||
    Boolean(process.env.ADMIN_API_KEY && req.headers['authorization'] === `Bearer ${process.env.ADMIN_API_KEY}`);

  if (isAdmin) {
    return res.status(403).json({
      error: 'Role-Based Access Control: Admin accounts are restricted from creating or submitting e-filings. E-filing creation is strictly reserved for verified MSME Business Owners.'
    });
  }

  const data = parseBody(ticketSchema, req, res);
  if (!data) return;
  const trackingNumber = `PREP-SC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const result = database.prepare(`
    INSERT INTO efiling_tickets
      (user_id, tracking_number, business_name, business_type, municipality,
       filing_stage, status, priority, location_sketch_desc, documents_json, notes, assigned_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.account.id, trackingNumber, data.businessName, data.businessType, data.municipality,
    data.filingStage, data.status || 'Draft', data.priority || 'standard',
    data.locationSketchDesc || '', JSON.stringify(data.documents || []),
    data.notes || '', `Registration Prep Desk (${data.municipality})`
  );
  res.status(201).json({ ticket: { ...data, id: Number(result.lastInsertRowid), trackingNumber, documents: data.documents || [], assignedAgent: 'Personal preparation workspace', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
});

app.patch('/api/efiling/tickets/:id', optionalAuthentication, (req: any, res) => {
  const id = Number(req.params.id);
  const data = parseBody(ticketUpdateSchema, req, res);
  if (!data) return;
  const existing = database.prepare('SELECT id FROM efiling_tickets WHERE id = ? AND user_id = ?').get(id, req.account.id);
  if (!existing) return res.status(404).json({ error: 'Filing ticket not found.' });

  database.prepare(`
    UPDATE efiling_tickets
    SET status = COALESCE(?, status),
        filing_stage = COALESCE(?, filing_stage),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(data.status ?? null, data.filingStage ?? null, data.notes ?? null, id, req.account.id);

  const updated = database.prepare('SELECT id, tracking_number AS trackingNumber, business_name AS businessName, business_type AS businessType, municipality, filing_stage AS filingStage, status, priority, location_sketch_desc AS locationSketchDesc, documents_json AS documentsJson, notes, assigned_agent AS assignedAgent, created_at AS createdAt, updated_at AS updatedAt FROM efiling_tickets WHERE id = ? AND user_id = ?').get(id, req.account.id) as any;
  res.json({ ticket: { ...updated, documents: JSON.parse(updated.documentsJson || '[]') } });
});

app.delete('/api/efiling/tickets/:id', optionalAuthentication, (req: any, res) => {
  const id = Number(req.params.id);
  database.prepare('DELETE FROM efiling_tickets WHERE id = ? AND user_id = ?').run(id, req.account.id);
  res.status(204).end();
});

// === MODULE A: SMART REFERRAL ENGINE (SUBSIDY & CREDIT) ===
app.post('/api/referrals/subsidy-check', (req, res) => {
  const data = parseBody(subsidyCheckSchema, req, res);
  if (!data) return;
  const matches = evaluateSubsidies(data);
  res.json({ matches });
});

app.post('/api/referrals/credit-match', (req, res) => {
  const data = parseBody(creditMatchSchema, req, res);
  if (!data) return;
  const matches = evaluateCredit(data);
  res.json({ matches });
});

// === MODULE A: AUTOMATED DOCUMENT GENERATION & OPT-IN STORAGE ===
app.post('/api/ai/generate-doc', optionalAuthentication, async (req: any, res) => {
  const data = parseBody(documentGenerateSchema, req, res);
  if (!data) return;
  const generated = await generateDocumentWithAI(data, req.account);

  if (req.body.saveToLibrary === true) {
    const result = database.prepare(`
      INSERT INTO generated_documents (user_id, doc_type, title, business_name, municipality, content_html, summary_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.account?.id || null, data.docType, generated.title, data.businessName,
      data.municipality, generated.contentHtml, JSON.stringify(generated.summary)
    );
    const docId = Number(result.lastInsertRowid);
    await indexDocumentChunks(docId, generated.title, generated.contentHtml);

    return res.status(201).json({
      document: {
        id: docId,
        docType: data.docType,
        title: generated.title,
        businessName: data.businessName,
        municipality: data.municipality,
        contentHtml: generated.contentHtml,
        summary: generated.summary,
        saved: true,
        createdAt: new Date().toISOString()
      },
      success: true
    });
  }

  // Opt-In Saving: Return generated draft WITHOUT auto-saving to library
  res.status(200).json({
    document: {
      id: Date.now(),
      docType: data.docType,
      title: generated.title,
      businessName: data.businessName,
      municipality: data.municipality,
      contentHtml: generated.contentHtml,
      summary: generated.summary,
      saved: false,
      createdAt: new Date().toISOString()
    },
    success: true
  });
});

app.post('/api/ai/save-doc', optionalAuthentication, async (req: any, res) => {
  const parsed = z.object({
    id: z.number().int().positive().optional(), docType: z.enum(['business_plan', 'feasibility_study', 'grant_loan_proposal']).default('business_plan'),
    title: z.string().trim().min(1).max(400), businessName: z.string().max(200).default('MSME Enterprise'), municipality: z.string().max(100).default('South Cotabato'),
    contentHtml: z.string().min(1).max(500000), summary: z.record(z.string(), z.unknown()).default({})
  }).safeParse(req.body?.doc || req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Review the document title and content before saving.' });
  const body = parsed.data;
  const existing = body.id ? database.prepare('SELECT id FROM generated_documents WHERE id = ? AND user_id = ?').get(body.id, req.account.id) as any : null;
  let docId: number;
  if (existing) {
    database.prepare('UPDATE generated_documents SET title = ?, content_html = ?, summary_json = ? WHERE id = ? AND user_id = ?').run(body.title, body.contentHtml, JSON.stringify(body.summary), existing.id, req.account.id);
    docId = existing.id;
  } else {
    const result = database.prepare(`
    INSERT INTO generated_documents (user_id, doc_type, title, business_name, municipality, content_html, summary_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.account?.id || null, body.docType || 'business_plan', body.title, body.businessName || 'MSME Enterprise',
    body.municipality || 'South Cotabato', body.contentHtml, JSON.stringify(body.summary || {})
  );

    docId = Number(result.lastInsertRowid);
  }
  await indexDocumentChunks(docId, body.title, body.contentHtml);

  res.status(existing ? 200 : 201).json({
    document: {
      id: docId,
      docType: body.docType || 'business_plan',
      title: body.title,
      businessName: body.businessName || 'MSME Enterprise',
      municipality: body.municipality || 'South Cotabato',
      contentHtml: body.contentHtml,
      summary: body.summary || {},
      saved: true,
      createdAt: new Date().toISOString()
    },
    success: true
  });
});

app.get('/api/ai/documents', optionalAuthentication, (req: any, res) => {
  const documents = database.prepare(`
    SELECT id, doc_type AS docType, title, business_name AS businessName,
           municipality, content_html AS contentHtml, summary_json AS summaryJson,
           created_at AS createdAt
    FROM generated_documents WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.account.id) as any[];
  res.json({ documents: documents.map(({ summaryJson, ...document }) => ({ ...document, summary: JSON.parse(summaryJson || '{}') })) });
});

app.get('/api/ai/documents/:id', optionalAuthentication, (req: any, res) => {
  const id = Number(req.params.id);
  const doc = database.prepare(`
    SELECT id, doc_type AS docType, title, business_name AS businessName,
           municipality, content_html AS contentHtml, summary_json AS summaryJson,
           created_at AS createdAt
    FROM generated_documents
    WHERE id = ? AND user_id = ?
  `).get(id, req.account.id) as any;
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  res.json({ document: { ...doc, summary: JSON.parse(doc.summaryJson || '{}') } });
});

// === MODULE B: LOCAL SUPPLIER REVIEWS & MESSAGING ===
app.get('/api/suppliers/:id/reviews', (req, res) => {
  const supplierId = Number(req.params.id);
  const reviews = database.prepare(`
    SELECT id, reviewer_name AS reviewerName, reviewer_business AS reviewerBusiness,
           rating, review_text AS reviewText, verified_transaction AS verifiedTransaction,
           created_at AS createdAt
    FROM supplier_reviews
    WHERE supplier_id = ?
    ORDER BY created_at DESC
  `).all(supplierId);
  res.json({ reviews });
});

app.post('/api/suppliers/:id/reviews', optionalAuthentication, (req: any, res) => {
  const supplierId = Number(req.params.id);
  if (!database.prepare("SELECT id FROM suppliers WHERE id = ? AND status = 'active'").get(supplierId)) return res.status(404).json({ error: 'Supplier not found.' });
  const data = parseBody(supplierReviewSchema, req, res);
  if (!data) return;
  database.prepare(`
    INSERT INTO supplier_reviews (supplier_id, user_id, reviewer_name, reviewer_business, rating, review_text, verified_transaction)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(
    supplierId, req.account.id,
    `${req.account.firstName} ${req.account.lastName}`.trim(),
    req.account.business || 'Verified MSME Member',
    data.rating, data.reviewText
  );
  res.status(201).json({ success: true });
});

app.get('/api/suppliers/messages', optionalAuthentication, (req: any, res) => {
  const messages = database.prepare(`
    SELECT m.id, m.supplier_id AS supplierId, s.business_name AS supplierName,
           m.subject, m.message, m.status, m.reply, m.created_at AS createdAt
    FROM supplier_messages m
    JOIN suppliers s ON s.id = m.supplier_id
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC
  `).all(req.account.id);
  res.json({ messages });
});

app.post('/api/suppliers/:id/messages', optionalAuthentication, (req: any, res) => {
  const supplierId = Number(req.params.id);
  if (!database.prepare("SELECT id FROM suppliers WHERE id = ? AND status = 'active'").get(supplierId)) return res.status(404).json({ error: 'Supplier not found.' });
  const data = parseBody(supplierMessageCreateSchema, req, res);
  if (!data) return;
  const result = database.prepare(`
    INSERT INTO supplier_messages (supplier_id, user_id, sender_name, sender_email, subject, message, status)
    VALUES (?, ?, ?, ?, ?, ?, 'sent')
  `).run(
    supplierId, req.account.id,
    `${req.account.firstName} ${req.account.lastName}`.trim(),
    req.account.email,
    data.subject, data.message
  );
  res.status(201).json({ id: Number(result.lastInsertRowid), success: true });
});

app.post('/api/boss-nana', requireAuthentication, submissionLimiter, async (req: any, res) => {
  const data = parseBody(assistantSchema, req, res);
  if (!data) return;
  const result = await createAssistantAnswer(data.question, data.history, data.language, req.account);
  res.set('Cache-Control', 'no-store').json(result);
});

app.post('/api/assistant', submissionLimiter, async (req, res) => {
  const data = parseBody(assistantSchema, req, res);
  if (!data) return;
  const result = await createAssistantAnswer(data.question, data.history, data.language);
  res.set('Cache-Control', 'no-store').json(result);
});

app.post('/api/marketing/generate', optionalAuthentication, submissionLimiter, async (req: any, res) => {
  const data = parseBody(marketingGenerateSchema, req, res);
  if (!data) return;
  const copy = await generateMarketingCopy(data);
  res.json({ copy, success: true });
});

app.get('/api/suppliers', (_req, res) => {
  const suppliers = database.prepare(`
    SELECT s.id, s.business_name AS name, s.category, s.location, s.products,
           s.public_email AS publicEmail, s.public_phone AS publicPhone, s.website,
           s.verified_at AS verifiedAt,
           COALESCE(ROUND(AVG(r.rating), 1), 0) AS averageRating,
           COUNT(r.id) AS reviewCount
    FROM suppliers s
    LEFT JOIN supplier_reviews r ON r.supplier_id = s.id
    WHERE s.status = 'active' AND s.verified_at <> '' AND s.expires_at > CURRENT_TIMESTAMP
      AND s.website NOT LIKE '%.example.ph%' AND s.public_email NOT LIKE '%@%.example.ph'
    GROUP BY s.id
    ORDER BY s.business_name COLLATE NOCASE
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

// Return API errors as JSON so clients can give useful feedback without simulating success.
app.use('/api', (_req, res) => { res.status(404).json({ error: 'This action was not found.' }); });
app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api')) return next(error);
  const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
  res.status(status).json({ error: status === 413 ? 'This request is too large. Use fewer records and try again.' : status === 400 ? 'This request could not be read. Review your entries and try again.' : 'This action could not be completed. Please try again.' });
});
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
    app.get('/{*path}', (_req, res) => {
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
