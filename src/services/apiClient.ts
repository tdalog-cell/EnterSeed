import {
  SubsidyInput,
  SubsidyMatch,
  CreditInput,
  CreditMatch,
  evaluateSubsidies,
  evaluateCredit,
  calculatePaybackPeriod
} from '../utils/msmeLogic';

export type {
  SubsidyInput,
  SubsidyMatch,
  CreditInput,
  CreditMatch
};

export function formatPesos(amount: number): string {
  return `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export interface EfilingTicket {
  id: number;
  trackingNumber: string;
  businessName: string;
  businessType: 'Sole Proprietorship' | 'Partnership' | 'Corporation' | 'Cooperative' | 'Barangay Micro-Business (BMBE)';
  municipality: string;
  filingStage: 'Business Name' | 'Barangay Clearance' | "Mayor's Permit / BPLO" | 'BIR Registration' | 'Location & Zoning' | 'All-in-One Consolidated Filing';
  status: 'Draft' | 'Document Prep' | 'Submitted to LGU' | 'Under Inspection' | 'Approved' | 'Action Needed';
  priority: 'standard' | 'expedited' | 'urgent_renewal';
  locationSketchDesc: string;
  documents: string[];
  notes: string;
  assignedAgent: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedDocument {
  id: number;
  docType: 'feasibility_study' | 'business_plan' | 'grant_loan_proposal';
  title: string;
  businessName: string;
  municipality: string;
  contentHtml: string;
  summary: {
    businessName: string;
    municipality: string;
    sector: string;
    projectedRevenue: number;
    paybackMonths: number;
  };
  createdAt: string;
}

export interface SupplierReview {
  id: number;
  supplierId?: number;
  reviewerName: string;
  reviewerBusiness: string;
  rating: number;
  reviewText: string;
  verifiedTransaction: number | boolean;
  createdAt: string;
}

export interface SupplierMessage {
  id: number;
  supplierId: number;
  supplierName?: string;
  subject: string;
  message: string;
  status: 'sent' | 'read' | 'replied';
  reply?: string;
  createdAt: string;
}

export interface SupplierListing {
  id: number;
  name: string;
  category: string;
  location: string;
  products: string;
  publicEmail?: string;
  publicPhone?: string;
  website?: string;
  verifiedAt: string;
  averageRating?: number;
  reviewCount?: number;
}

// Real requests never silently fall back to simulated authentication or storage.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const DEMO_SESSION_KEY = 'enterseed_demo_session_v2';
type DemoProfile = { id?: number; email: string; firstName: string; lastName: string; business: string; municipality?: string; role?: string; preferredLanguage?: string };

function readStored<T>(storage: Storage, key: string, fallback: T): T {
  try { const value = storage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}

export function isStaticDemoHost(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

export function getDemoUser(): DemoProfile | null {
  if (typeof sessionStorage === 'undefined') return null;
  return readStored<DemoProfile | null>(sessionStorage, DEMO_SESSION_KEY, null);
}

export function isDemoMode(): boolean { return Boolean(getDemoUser()); }

export function startDemoSession(profile: DemoProfile): void {
  // A demonstration must never carry a real account's bearer token.
  localStorage.removeItem('enterseed_token');
  sessionStorage.removeItem('enterseed_token');
  sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ ...profile, role: 'owner' }));
}

export function endDemoSession(): void { sessionStorage.removeItem(DEMO_SESSION_KEY); }

function demoKey(name: string): string {
  const profile = getDemoUser();
  return `enterseed_demo_v2:${encodeURIComponent(profile?.email.toLowerCase() || 'visitor')}:${name}`;
}
function demoRead<T>(name: string, fallback: T): T { return readStored(localStorage, demoKey(name), fallback); }
function demoWrite(name: string, value: unknown): void { localStorage.setItem(demoKey(name), JSON.stringify(value)); }
function jsonResponse(status: number, data: any, demo = false): Response {
  return new Response(JSON.stringify(demo ? { ...data, demo: true } : data), {
    status, headers: { 'Content-Type': 'application/json', ...(demo ? { 'X-Enterseed-Mode': 'demo' } : {}) }
  });
}
function demoResponse(status: number, data: any): Response { return jsonResponse(status, data, true); }

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  if (isDemoMode() || isStaticDemoHost()) {
    try { return handleDemoRequest(endpoint, options); }
    catch { return demoResponse(507, { error: 'Your browser could not save this demo change. Check available storage and try again.' }); }
  }
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  const token = sessionStorage.getItem('enterseed_token') || localStorage.getItem('enterseed_token');
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options, headers, credentials: API_BASE ? 'include' : 'same-origin',
      signal: options.signal || AbortSignal.timeout(30000)
    });
    if (response.status === 204 || response.headers.get('content-type')?.includes('application/json')) return response;
    return jsonResponse(response.ok ? 502 : response.status, { error: 'The server did not return a valid response. Please try again.' });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return jsonResponse(503, { error: 'Could not connect to the server. Your changes have not been saved. Please try again.' });
  }
}

const demoSuppliers: SupplierListing[] = [
  { id: 1, name: 'Sample Packaging Studio', category: 'packaging', location: 'Polomolok', products: 'Sample corrugated boxes and reusable packaging', verifiedAt: '', averageRating: 0, reviewCount: 0 },
  { id: 2, name: 'Sample Coffee Cooperative', category: 'raw-materials', location: 'Tupi', products: 'Sample green and roasted coffee beans', verifiedAt: '', averageRating: 0, reviewCount: 0 },
  { id: 3, name: 'Sample Creative Studio', category: 'marketing', location: 'City of Koronadal', products: 'Sample photography and social media services', verifiedAt: '', averageRating: 0, reviewCount: 0 },
  { id: 4, name: 'Sample Weaving Workshop', category: 'raw-materials', location: 'Lake Sebu', products: 'Sample textiles and craft materials', verifiedAt: '', averageRating: 0, reviewCount: 0 },
  { id: 5, name: 'Sample Delivery Service', category: 'services', location: 'Surallah', products: 'Sample delivery and storage services', verifiedAt: '', averageRating: 0, reviewCount: 0 }
];
const referenceSources = [
  { label: 'DTI Business Name Registration System', url: 'https://bnrs.dti.gov.ph/' },
  { label: 'Bureau of Internal Revenue', url: 'https://www.bir.gov.ph/' },
  { label: 'DOST Region 12', url: 'https://region12.dost.gov.ph/' },
  { label: 'Small Business Corporation', url: 'https://sbcorp.gov.ph/' }
];
const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

function handleDemoRequest(endpoint: string, options: RequestInit): Response {
  const method = (options.method || 'GET').toUpperCase();
  let body: any = {};
  try { body = options.body ? JSON.parse(String(options.body)) : {}; }
  catch { return demoResponse(400, { error: 'The request could not be read.' }); }
  const user = getDemoUser();
  if (endpoint === '/api/health') return demoResponse(200, { ok: true, emailConfigured: false, mode: 'demo' });
  if (endpoint === '/api/auth/login' || endpoint === '/api/auth/register') {
    return demoResponse(409, { error: 'This is a demo preview. Choose Quick Demo to explore; account sign-in requires a connected Enterseed server.' });
  }
  if (endpoint === '/api/auth/me') return user ? demoResponse(200, { user }) : demoResponse(401, { error: 'Choose Quick Demo to open a sample workspace.' });
  if (endpoint === '/api/auth/logout') { endDemoSession(); return new Response(null, { status: 204 }); }
  if (endpoint === '/api/suppliers' && method === 'GET') return demoResponse(200, { suppliers: demoSuppliers });
  if (/^\/api\/suppliers\/\d+\/reviews$/.test(endpoint) && method === 'GET') return demoResponse(200, { reviews: [] });
  if (endpoint.startsWith('/api/admin')) return demoResponse(403, { error: 'Staff actions require an authenticated staff account on the connected server.' });
  if (['/api/inquiries', '/api/supplier-applications'].includes(endpoint) || /\/(contact|messages|reviews)$/.test(endpoint) && method === 'POST') {
    return demoResponse(409, { error: 'This is a demo workspace. Messages and applications are not sent. Sign in to a connected account to submit.' });
  }
  if (endpoint.startsWith('/api/places/search')) return demoResponse(503, { error: 'Place search needs a connected server. Browse the sample locations on the map.' });
  if (!user && endpoint !== '/api/assistant') return demoResponse(401, { error: 'Choose Quick Demo to open a sample workspace.' });

  if (endpoint === '/api/auth/language' && method === 'PATCH') {
    sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify({ ...user, preferredLanguage: body.language }));
    return demoResponse(200, { preferredLanguage: body.language });
  }
  if (endpoint === '/api/user/export-data') {
    return demoResponse(200, { profile: user, exportedAt: new Date().toISOString(), assessment: demoRead('finance', null), workspace: demoRead('finance_workspace', null), registrationDraft: demoRead('registration_draft', null), tickets: demoRead('tickets', []), documents: demoRead('documents', []) });
  }
  if (endpoint === '/api/user/delete-data' && method === 'DELETE') {
    const prefix = demoKey('');
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key) => key?.startsWith(prefix));
    keys.forEach((key) => localStorage.removeItem(key!));
    endDemoSession();
    return demoResponse(200, { success: true });
  }
  if (endpoint === '/api/registration/draft') {
    if (method === 'GET') return demoResponse(200, { draft: demoRead('registration_draft', null) });
    if (method === 'PUT') { demoWrite('registration_draft', body.draft); return demoResponse(200, { saved: true, draft: body.draft }); }
  }
  if (endpoint === '/api/finance/assessment' || endpoint === '/api/finance/workspace') {
    const workspace = endpoint.endsWith('/workspace');
    const key = workspace ? 'finance_workspace' : 'finance';
    const field = workspace ? 'workspace' : 'assessment';
    if (method === 'GET') return demoResponse(200, { [field]: demoRead(key, null) });
    if (method === 'PUT' || method === 'POST') {
      const value = workspace ? (body.workspace ?? body) : { ...body, updatedAt: new Date().toISOString() };
      demoWrite(key, value);
      return demoResponse(200, { saved: true, [field]: value });
    }
    if (method === 'DELETE') { localStorage.removeItem(demoKey(key)); return new Response(null, { status: 204 }); }
  }
  if (endpoint === '/api/efiling/tickets') {
    const tickets = demoRead<EfilingTicket[]>('tickets', []);
    if (method === 'GET') return demoResponse(200, { tickets });
    if (method === 'POST') {
      if (!body.businessName?.trim() || !body.municipality?.trim() || !body.filingStage) return demoResponse(400, { error: 'Complete the business, municipality, and preparation stage.' });
      const now = new Date().toISOString();
      const ticket: EfilingTicket = { ...body, id: Date.now(), trackingNumber: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: body.status || 'Draft', priority: body.priority || 'standard', locationSketchDesc: body.locationSketchDesc || '', documents: body.documents || [], notes: body.notes || '', assignedAgent: 'Personal preparation workspace', createdAt: now, updatedAt: now };
      demoWrite('tickets', [ticket, ...tickets]);
      return demoResponse(201, { ticket });
    }
  }
  if (endpoint.startsWith('/api/efiling/tickets/')) {
    const id = Number(endpoint.split('/').pop());
    const tickets = demoRead<EfilingTicket[]>('tickets', []);
    const ticket = tickets.find((entry) => entry.id === id);
    if (!ticket) return demoResponse(404, { error: 'Preparation record not found.' });
    if (method === 'PATCH') {
      for (const field of ['status', 'filingStage', 'notes'] as const) if (body[field] !== undefined) (ticket as any)[field] = body[field];
      ticket.updatedAt = new Date().toISOString();
      demoWrite('tickets', tickets);
      return demoResponse(200, { ticket });
    }
    if (method === 'DELETE') { demoWrite('tickets', tickets.filter((entry) => entry.id !== id)); return new Response(null, { status: 204 }); }
  }
  if (endpoint === '/api/referrals/subsidy-check' && method === 'POST') return demoResponse(200, { matches: evaluateSubsidies(body) });
  if (endpoint === '/api/referrals/credit-match' && method === 'POST') return demoResponse(200, { matches: evaluateCredit(body) });
  if (endpoint === '/api/ai/generate-doc' && method === 'POST') {
    if (!body.businessName?.trim() || !body.targetMarket?.trim()) return demoResponse(400, { error: 'Add your business name and target market.' });
    const titles = { feasibility_study: 'Feasibility study draft', business_plan: 'Business plan draft', grant_loan_proposal: 'Funding proposal draft' };
    const title = `${titles[body.docType as keyof typeof titles] || 'Business draft'} — ${body.businessName}`;
    const monthlyRevenue = Math.max(0, Number(body.monthlyRevenue) || 0);
    const requestedAmount = Math.max(0, Number(body.requestedAmount) || 0);
    const annualRevenue = monthlyRevenue * 12;
    const document: GeneratedDocument = {
      id: Date.now(), docType: body.docType, title, businessName: body.businessName, municipality: body.municipality,
      contentHtml: `<article><h1>${escapeHtml(title)}</h1><p>Enterseed demo draft · Prepared from your inputs. No application has been submitted.</p><h2>Business overview</h2><p>${escapeHtml(body.businessName)} · ${escapeHtml(body.municipality)} · ${escapeHtml(body.sector)}</p><h2>Target market</h2><p>${escapeHtml(body.targetMarket)}</p><h2>Operations and suppliers</h2><p>${escapeHtml(body.supplyChainNotes || 'Add supplier quotations, capacity, and delivery assumptions.')}</p><h2>Financial assumptions</h2><p>Monthly sales input: ${formatPesos(monthlyRevenue)}. Annual sales at the same monthly level: ${formatPesos(annualRevenue)}. Funding requested: ${formatPesos(requestedAmount)}.</p><p>Add operating costs, taxes, debt payments, and seasonal changes before estimating profit or payback. Sales alone do not establish profitability.</p><h2>Next steps</h2><p>Validate customer demand and costs, attach supporting records, and check current registration or funding requirements with the relevant official agency.</p></article>`,
      summary: { businessName: body.businessName, municipality: body.municipality, sector: body.sector, projectedRevenue: annualRevenue, paybackMonths: 0 }, createdAt: new Date().toISOString()
    };
    if (body.saveToLibrary) demoWrite('documents', [document, ...demoRead<GeneratedDocument[]>('documents', [])]);
    return demoResponse(201, { document });
  }
  if (endpoint === '/api/ai/save-doc' && method === 'POST') {
    const document = body.doc || body;
    if (!document.title || !document.contentHtml) return demoResponse(400, { error: 'Document content is required.' });
    const documents = demoRead<GeneratedDocument[]>('documents', []);
    demoWrite('documents', [document, ...documents.filter((entry) => entry.id !== document.id)]);
    return demoResponse(200, { document });
  }
  if (endpoint === '/api/ai/documents') return demoResponse(200, { documents: demoRead('documents', []) });
  if (endpoint.startsWith('/api/ai/documents/')) {
    const document = demoRead<GeneratedDocument[]>('documents', []).find((entry) => entry.id === Number(endpoint.split('/').pop()));
    return document ? demoResponse(200, { document }) : demoResponse(404, { error: 'Document not found.' });
  }
  if (endpoint === '/api/suppliers/messages' && method === 'GET') return demoResponse(200, { messages: [] });
  if (endpoint === '/api/marketing/generate' && method === 'POST') {
    if (!body.businessName?.trim() || !body.productOrOffer?.trim()) return demoResponse(400, { error: 'Add your business and product or offer.' });
    const intro = body.language === 'fil' ? `Kilalanin ang ${body.productOrOffer} mula sa ${body.businessName}!` : `${body.productOrOffer} from ${body.businessName}.`;
    return demoResponse(200, { copy: `${intro}\n\n${body.keyDetails || 'Add your price, availability, and contact details before sharing.'}\n\n${body.language === 'fil' ? 'Mag-message para sa mga detalye.' : 'Get in touch for details.'}`, success: true });
  }
  if (endpoint === '/api/boss-nana' || endpoint === '/api/assistant') {
    const answer = body.language === 'fil'
      ? 'Nasa demo workspace ka. Maaari kitang tulungan sa pag-aayos ng business plan, pagtatala ng gastos, at paghahanda ng checklist. Walang aplikasyon na isinusumite rito. Tingnan ang mga opisyal na sanggunian para sa kasalukuyang requirements at bayarin.'
      : 'You are in a demo workspace. Use the finance tools to record costs, the document builder to organize a draft, and the preparation tracker to maintain a checklist. Nothing here submits a government application. Verify current requirements and fees using the official sources below.';
    return demoResponse(200, { answer, mode: 'demo', sources: referenceSources });
  }
  if (endpoint === '/api/readiness' && method === 'POST') {
    const token = crypto.randomUUID(); demoWrite(`readiness:${token}`, body);
    return demoResponse(201, { received: false, savedLocally: true, deleteToken: token, retentionDays: 0 });
  }
  if (endpoint.startsWith('/api/readiness/') && method === 'DELETE') { localStorage.removeItem(demoKey(`readiness:${endpoint.split('/').pop()}`)); return new Response(null, { status: 204 }); }
  return demoResponse(404, { error: 'This action is not available in the demo workspace.' });
}

// === EXPORTED HIGH-LEVEL API FUNCTIONS ===

export async function fetchTickets(): Promise<EfilingTicket[]> {
  const res = await apiFetch('/api/efiling/tickets');
  if (!res.ok) throw new Error('Could not load e-filing tickets.');
  const data = await res.json();
  return data.tickets || [];
}

export async function createTicket(ticket: {
  businessName: string;
  businessType: string;
  municipality: string;
  filingStage: string;
  status?: string;
  priority?: string;
  locationSketchDesc?: string;
  documents?: string[];
  notes?: string;
}): Promise<EfilingTicket> {
  const res = await apiFetch('/api/efiling/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create filing ticket.');
  }
  const data = await res.json();
  return data.ticket;
}

export async function updateTicket(id: number, updates: {
  status?: string;
  filingStage?: string;
  notes?: string;
}): Promise<EfilingTicket> {
  const res = await apiFetch(`/api/efiling/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update ticket.');
  const data = await res.json();
  return data.ticket;
}

export async function deleteTicket(id: number): Promise<void> {
  const res = await apiFetch(`/api/efiling/tickets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete ticket.');
}

export async function runSubsidyCheck(input: SubsidyInput): Promise<SubsidyMatch[]> {
  const res = await apiFetch('/api/referrals/subsidy-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error('Failed to evaluate subsidies.');
  const data = await res.json();
  return data.matches || [];
}

export async function runCreditMatch(input: CreditInput): Promise<CreditMatch[]> {
  const res = await apiFetch('/api/referrals/credit-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) throw new Error('Failed to match credit facilities.');
  const data = await res.json();
  return data.matches || [];
}

export async function generateDocument(input: {
  docType: 'feasibility_study' | 'business_plan' | 'grant_loan_proposal';
  businessName: string;
  municipality: string;
  sector: string;
  requestedAmount?: number;
  monthlyRevenue?: number;
  targetMarket: string;
  supplyChainNotes?: string;
  saveToLibrary?: boolean;
}): Promise<GeneratedDocument> {
  const res = await apiFetch('/api/ai/generate-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate document.');
  }
  const data = await res.json();
  return data.document;
}

export async function saveDocumentToLibrary(doc: GeneratedDocument): Promise<GeneratedDocument> {
  const res = await apiFetch('/api/ai/save-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doc })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save document to library.');
  }
  const data = await res.json();
  return data.document || doc;
}

export async function fetchGeneratedDocs(): Promise<GeneratedDocument[]> {
  const res = await apiFetch('/api/ai/documents');
  if (!res.ok) throw new Error((await res.json()).error || 'Your document library could not load. Please retry.');
  const data = await res.json();
  return data.documents || [];
}

export async function fetchSupplierReviews(supplierId: number): Promise<SupplierReview[]> {
  const res = await apiFetch(`/api/suppliers/${supplierId}/reviews`);
  if (!res.ok) throw new Error((await res.json()).error || 'Reviews could not load. Please retry.');
  const data = await res.json();
  return data.reviews || [];
}

export async function submitSupplierReview(supplierId: number, review: { rating: number; reviewText: string }): Promise<void> {
  const res = await apiFetch(`/api/suppliers/${supplierId}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit review.');
  }
}

export async function fetchSupplierMessages(): Promise<SupplierMessage[]> {
  const res = await apiFetch('/api/suppliers/messages');
  if (!res.ok) throw new Error((await res.json()).error || 'Your messages could not load. Please retry.');
  const data = await res.json();
  return data.messages || [];
}

export async function sendSupplierMessage(supplierId: number, msg: { subject: string; message: string }): Promise<void> {
  const res = await apiFetch(`/api/suppliers/${supplierId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send message.');
  }
}
