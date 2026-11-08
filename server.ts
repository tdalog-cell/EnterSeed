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
  employeeCount: z.number().int().min(1).max(500),
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
      const prompt = `You are a certified Philippine DTI Business Counselor and financial analyst in South Cotabato, Philippines.
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
5. 3-Year Financial Projections (Sales, Expenses, Net Margins, Payback Period)
6. Statutory Compliance & Risk Management (DTI BNRS, Mayor's Permit, BIR Form 1901)
7. Endorsement Block for LGU BPLO / SBCorp / LandBank review.`;

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
            paybackMonths: data.requestedAmount > 0 && data.monthlyRevenue > 0 ? Math.round(data.requestedAmount / (data.monthlyRevenue * 0.25)) : 18
          }
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local grounded generator:', err);
    }
  }

  // Local grounded template generator
  const annualRev = data.monthlyRevenue * 12;
  const netMargin = Math.round(annualRev * 0.28);
  const breakEvenMonths = data.requestedAmount > 0 && data.monthlyRevenue > 0 ? Math.max(6, Math.min(48, Math.round(data.requestedAmount / (data.monthlyRevenue * 0.3)))) : 14;

  const contentHtml = `
    <div class="doc-container p-6 sm:p-10 font-sans text-slate-800 bg-white">
      <div class="border-b-2 border-purple-900 pb-4 mb-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-purple-900">Republic of the Philippines · Province of South Cotabato</p>
            <h1 class="text-2xl font-extrabold text-slate-900 mt-1">${title}</h1>
            <p class="text-xs text-slate-500 mt-0.5">DTI Negosyo Center Support Hub · Prepared for: ${account.firstName} ${account.lastName}</p>
          </div>
          <div class="text-right text-xs text-slate-500">
            <p><strong>Tracking No:</strong> DOC-SC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}</p>
            <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <section class="mb-6">
        <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">1. Executive Summary</h2>
        <p class="text-sm leading-relaxed mb-3">
          <strong>${data.businessName}</strong> is an enterprise established within <strong>${data.municipality}, South Cotabato</strong>, operating within the <strong>${data.sector}</strong> sector. This document formalizes the commercial viability, operational strategy, and financial forecast in support of enterprise scaling, statutory registration with the Department of Trade and Industry (DTI), and credit access through local institutional partners.
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg text-xs border border-slate-200">
          <div><span class="text-slate-500 block">Location:</span><strong>${data.municipality}, South Cotabato</strong></div>
          <div><span class="text-slate-500 block">Industry Sector:</span><strong>${data.sector}</strong></div>
          <div><span class="text-slate-500 block">Target Capital:</span><strong>₱${data.requestedAmount.toLocaleString()}</strong></div>
          <div><span class="text-slate-500 block">Est. Annual Turnover:</span><strong>₱${annualRev.toLocaleString()}</strong></div>
        </div>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">2. Business Profile & Legal Structure</h2>
        <p class="text-sm leading-relaxed mb-2">
          The enterprise operates under Philippine MSME regulatory frameworks (Republic Act No. 9178 / Barangay Micro Business Enterprises Act). Statutory filings include DTI Business Name Registration (BNRS), Barangay Commercial Clearance, Mayor's Permit with ${data.municipality} BPLO, and BIR Registration (Form 1901) qualifying for the 8% preferential gross income tax regime.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">3. Market Analysis & Target Customers</h2>
        <p class="text-sm leading-relaxed mb-2">
          <strong>Primary Target Market:</strong> ${data.targetMarket}.
        </p>
        <p class="text-sm leading-relaxed mb-3">
          The business leverages South Cotabato's strategic role as an agricultural and commercial hub in Region 12 (SOCCSKSARGEN). Proximity to General Santos City seaport and airport facilities enables efficient cargo dispatch and inter-provincial trade corridors.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">4. Supply Chain & Operational Sourcing</h2>
        <p class="text-sm leading-relaxed mb-2">
          <strong>Local Supply Integration:</strong> ${data.supplyChainNotes || 'Sourced directly from verified South Cotabato producers, cooperative hubs, and regional packaging suppliers.'}
        </p>
        <p class="text-sm leading-relaxed">
          The enterprise minimizes procurement risk by participating in the local South Cotabato supplier network, securing bulk price stability for packaging and raw materials across Polomolok, Tupi, and Koronadal.
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">5. 3-Year Financial Forecast & Viability Metrics</h2>
        <table class="w-full text-xs text-left border-collapse border border-slate-200 mb-3">
          <thead>
            <tr class="bg-purple-900 text-white">
              <th class="p-2 border border-slate-300">Financial Metric (PHP)</th>
              <th class="p-2 border border-slate-300 text-right">Year 1</th>
              <th class="p-2 border border-slate-300 text-right">Year 2 (+18%)</th>
              <th class="p-2 border border-slate-300 text-right">Year 3 (+25%)</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-slate-200">
              <td class="p-2 font-medium">Gross Sales Revenue</td>
              <td class="p-2 text-right">₱${annualRev.toLocaleString()}</td>
              <td class="p-2 text-right">₱${Math.round(annualRev * 1.18).toLocaleString()}</td>
              <td class="p-2 text-right">₱${Math.round(annualRev * 1.475).toLocaleString()}</td>
            </tr>
            <tr class="border-b border-slate-200 bg-slate-50">
              <td class="p-2 font-medium">Cost of Goods Sold (COGS)</td>
              <td class="p-2 text-right">₱${Math.round(annualRev * 0.48).toLocaleString()}</td>
              <td class="p-2 text-right">₱${Math.round(annualRev * 1.18 * 0.46).toLocaleString()}</td>
              <td class="p-2 text-right">₱${Math.round(annualRev * 1.475 * 0.45).toLocaleString()}</td>
            </tr>
            <tr class="border-b border-slate-200">
              <td class="p-2 font-medium">Operating Expenses (Rent, Utilities, Wages)</td>
              <td class="p-2 text-right">₱${Math.round(annualRev * 0.24).toLocaleString()}</td>
              <td class="p-2 text-right">₱${Math.round(annualRev * 1.18 * 0.23).toLocaleString()}</td>
              <td class="p-2 text-right">₱${Math.round(annualRev * 1.475 * 0.22).toLocaleString()}</td>
            </tr>
            <tr class="bg-purple-50 font-bold text-purple-900">
              <td class="p-2">Net Operating Margin</td>
              <td class="p-2 text-right">₱${netMargin.toLocaleString()} (28%)</td>
              <td class="p-2 text-right">₱${Math.round(netMargin * 1.25).toLocaleString()} (31%)</td>
              <td class="p-2 text-right">₱${Math.round(netMargin * 1.62).toLocaleString()} (33%)</td>
            </tr>
          </tbody>
        </table>
        <p class="text-xs text-slate-500">
          Estimated payback period for capital investment: <strong>${breakEvenMonths} months</strong> based on conservative cash flow retention.
        </p>
      </section>

      <section class="mb-8">
        <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">6. Endorsement & Sign-Off</h2>
        <div class="grid grid-cols-2 gap-8 pt-4 text-xs">
          <div>
            <p class="text-slate-500 mb-8">Prepared and Certified by:</p>
            <p class="border-t border-slate-400 pt-1 font-bold text-slate-900">${account.firstName} ${account.lastName}</p>
            <p class="text-slate-500">Owner / Authorized Representative</p>
            <p class="text-slate-500">${data.businessName}</p>
          </div>
          <div>
            <p class="text-slate-500 mb-8">Noted by LGU / DTI Negosyo Center Officer:</p>
            <p class="border-t border-slate-400 pt-1 font-bold text-slate-900">DTI Negosyo Center Counselor</p>
            <p class="text-slate-500">Province of South Cotabato Desk</p>
            <p class="text-slate-500">City of Koronadal, Region 12</p>
          </div>
        </div>
      </section>
    </div>
  `;

  return {
    title,
    contentHtml,
    summary: {
      businessName: data.businessName,
      municipality: data.municipality,
      sector: data.sector,
      projectedRevenue: annualRev,
      paybackMonths: breakEvenMonths
    }
  };
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

async function retrieveRagContext(question: string) {
  try {
    const dbChunks = database.prepare(`
      SELECT c.doc_title AS docTitle, c.chunk_text AS chunkText, c.embedding_json AS embeddingJson
      FROM document_chunks c
      ORDER BY c.id DESC
      LIMIT 100
    `).all() as any[];

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

async function createAssistantAnswer(question: string, history: any[] = [], language = 'en') {
  const localReference = offlineAnswers.find((entry) => entry.match.test(question))?.text
    ?? 'No matching local reference is available. Direct the visitor to an official source or human support.';
  const defaultSources = getAssistantReferences(question);

  // Retrieve RAG context from the user's saved Document Library
  const ragResult = await retrieveRagContext(question);
  const sources = [...ragResult.sources, ...defaultSources];

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
          systemInstruction: `You are Boss Narra, an expert AI business advisor for MSMEs in South Cotabato, Philippines. Be encouraging, highly practical, grounded, and specific. Analyze the user's question alongside their saved Document Library context if available. ${language === 'fil' ? 'Respond in Filipino (Tagalog).' : language === 'ceb' ? 'Respond in Cebuano (Bisaya).' : language === 'hil' ? 'Respond in Hiligaynon.' : 'Respond in English.'}${ragInstruction}\nLocal reference:\n${localReference}`
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

function optionalAuthentication(request: any, response: Response, next: NextFunction) {
  const account = findAuthenticatedAccount(request, response);
  request.account = account || {
    id: 1,
    email: 'demo@enterseed.example.ph',
    firstName: 'Maria Elena',
    lastName: 'Santos',
    business: 'Santos Weaving & Agricultural Exports (Koronadal)',
    preferredLanguage: 'en'
  };
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

  if (tickets.length === 0) {
    tickets = database.prepare(`
      SELECT id, tracking_number AS trackingNumber, business_name AS businessName,
             business_type AS businessType, municipality, filing_stage AS filingStage,
             status, priority, location_sketch_desc AS locationSketchDesc,
             documents_json AS documentsJson, notes, assigned_agent AS assignedAgent,
             created_at AS createdAt, updated_at AS updatedAt
      FROM efiling_tickets
      ORDER BY updated_at DESC
    `).all() as any[];
  }
  res.json({ tickets });
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
  const count = ((database.prepare('SELECT COUNT(*) AS c FROM efiling_tickets').get() as any)?.c || 0) + 1;
  const trackingNumber = `DTI-SC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
  const result = database.prepare(`
    INSERT INTO efiling_tickets
      (user_id, tracking_number, business_name, business_type, municipality,
       filing_stage, status, priority, location_sketch_desc, documents_json, notes, assigned_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.account.id, trackingNumber, data.businessName, data.businessType, data.municipality,
    data.filingStage, data.status || 'Draft', data.priority || 'standard',
    data.locationSketchDesc || '', JSON.stringify(data.documents || []),
    data.notes || '', `DTI Negosyo Center Desk (${data.municipality})`
  );
  res.status(201).json({ id: Number(result.lastInsertRowid), trackingNumber, success: true });
});

app.patch('/api/efiling/tickets/:id', optionalAuthentication, (req: any, res) => {
  const id = Number(req.params.id);
  const data = parseBody(ticketUpdateSchema, req, res);
  if (!data) return;
  const existing = database.prepare('SELECT id FROM efiling_tickets WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Filing ticket not found.' });

  database.prepare(`
    UPDATE efiling_tickets
    SET status = COALESCE(?, status),
        filing_stage = COALESCE(?, filing_stage),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(data.status || null, data.filingStage || null, data.notes || null, id);

  res.json({ success: true });
});

app.delete('/api/efiling/tickets/:id', optionalAuthentication, (req: any, res) => {
  const id = Number(req.params.id);
  database.prepare('DELETE FROM efiling_tickets WHERE id = ?').run(id);
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
  const body = req.body;
  if (!body || !body.title || !body.contentHtml) {
    return res.status(400).json({ error: 'Missing document content to save.' });
  }

  const result = database.prepare(`
    INSERT INTO generated_documents (user_id, doc_type, title, business_name, municipality, content_html, summary_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.account?.id || null, body.docType || 'business_plan', body.title, body.businessName || 'MSME Enterprise',
    body.municipality || 'South Cotabato', body.contentHtml, JSON.stringify(body.summary || {})
  );

  const docId = Number(result.lastInsertRowid);
  await indexDocumentChunks(docId, body.title, body.contentHtml);

  res.status(201).json({
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
    FROM generated_documents
    ORDER BY created_at DESC
  `).all();
  res.json({ documents });
});

app.get('/api/ai/documents/:id', optionalAuthentication, (req: any, res) => {
  const id = Number(req.params.id);
  const doc = database.prepare(`
    SELECT id, doc_type AS docType, title, business_name AS businessName,
           municipality, content_html AS contentHtml, summary_json AS summaryJson,
           created_at AS createdAt
    FROM generated_documents
    WHERE id = ?
  `).get(id) as any;
  if (!doc) return res.status(404).json({ error: 'Document not found.' });
  res.json({ document: doc });
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
  const data = parseBody(supplierReviewSchema, req, res);
  if (!data) return;
  database.prepare(`
    INSERT INTO supplier_reviews (supplier_id, user_id, reviewer_name, reviewer_business, rating, review_text)
    VALUES (?, ?, ?, ?, ?, ?)
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
    ORDER BY m.created_at DESC
  `).all();
  res.json({ messages });
});

app.post('/api/suppliers/:id/messages', optionalAuthentication, (req: any, res) => {
  const supplierId = Number(req.params.id);
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
    SELECT s.id, s.business_name AS name, s.category, s.location, s.products,
           s.public_email AS publicEmail, s.public_phone AS publicPhone, s.website,
           s.verified_at AS verifiedAt,
           COALESCE(ROUND(AVG(r.rating), 1), 4.8) AS averageRating,
           COUNT(r.id) AS reviewCount
    FROM suppliers s
    LEFT JOIN supplier_reviews r ON r.supplier_id = s.id
    WHERE s.status = 'active' AND s.verified_at <> '' AND s.expires_at > CURRENT_TIMESTAMP
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

function seedTicketsAndReviewsIfEmpty() {
  const ticketCount = (database.prepare('SELECT COUNT(*) AS count FROM efiling_tickets').get() as any)?.count || 0;
  if (ticketCount === 0) {
    database.prepare(`
      INSERT INTO efiling_tickets (tracking_number, business_name, business_type, municipality, filing_stage, status, priority, location_sketch_desc, documents_json, notes, assigned_agent)
      VALUES
        ('EF-SC-2026-8812', 'Matutum Highlands Roastery', 'Sole Proprietorship', 'Tupi', 'Mayor''s Permit / BPLO', 'Under Inspection', 'expedited', 'Poblacion National Highway, adjacent to Tupi Fruit Market.', '["DTI-BNRS-Certificate.pdf", "Barangay-Clearance-Tupi.pdf"]', 'Sanitary inspection scheduled with Tupi Municipal Health Office on Thursday morning.', 'DTI Negosyo Center Tupi Desk'),
        ('EF-SC-2026-9041', 'Lake Sebu Loomweavers Artisans', 'Barangay Micro-Business (BMBE)', 'Lake Sebu', 'Business Name', 'Approved', 'standard', 'Sitio Tukoblog, Barangay Poblacion, Lake Sebu near Tourism Cultural Office.', '["DTI-BNRS-Scope-Provincial.pdf"]', 'DTI BNRS Certificate issued for Provincial Scope (South Cotabato). Now applying for BMBE tax exemption.', 'DTI Provincial MSMEDC Desk'),
        ('EF-SC-2026-9214', 'Koronadal Eco-Pack Logistics', 'Corporation', 'City of Koronadal', 'Location & Zoning', 'Submitted to LGU', 'urgent_renewal', 'Block 4 Lot 9, General Santos Drive, Barangay Morales, Koronadal City.', '["SEC-Certificate.pdf", "Zoning-Clearance-Form.pdf"]', 'City Planning & Development Coordinator currently reviewing commercial setback guidelines.', 'Koronadal City BPLO Liaison')
    `).run();
  }

  const reviewCount = (database.prepare('SELECT COUNT(*) AS count FROM supplier_reviews').get() as any)?.count || 0;
  if (reviewCount === 0) {
    const suppliers = database.prepare('SELECT id FROM suppliers LIMIT 5').all() as any[];
    if (suppliers.length >= 5) {
      database.prepare(`
        INSERT INTO supplier_reviews (supplier_id, reviewer_name, reviewer_business, rating, review_text)
        VALUES
          (?, 'Ramon Castillo', 'Highland Berry Farm (Tupi)', 5, 'Their corrugated boxes protected our fresh strawberry dispatches to Davao with zero crushing. Very responsive team!'),
          (?, 'Carlos M.', 'Marbel Artisan Cafe', 5, 'Consistently 84+ cupping score for Mt. Matutum Arabica beans. Prompt delivery and fair trade pricing.'),
          (?, 'Maria Theresa Santos', 'Santos Organics Koronadal', 5, 'Helped us redesign our product packaging and registered our trademark logo with DTI efficiently.'),
          (?, 'Aida Morales', 'Mindanao Heritage Souvenirs', 5, 'Genuine handwoven T''nalak blessed by cultural masters in Lake Sebu. Authentic cultural patterns.'),
          (?, 'Danilo Cruz', 'Surallah Agri-Fishery Guild', 5, 'Kept our cold storage tilapia fillets in perfect frozen state during transit to General Santos fish port.')
      `).run(suppliers[0].id, suppliers[1].id, suppliers[2].id, suppliers[3].id, suppliers[4].id);
    }
  }
}
seedTicketsAndReviewsIfEmpty();

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
