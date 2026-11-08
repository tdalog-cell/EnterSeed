/**
 * Robust API Client with Dual-Mode Support:
 * 1. Full-Stack Server Mode: Uses real Express / SQLite backend when reachable.
 * 2. Static GitHub Pages Mode: When running as a static site on GitHub Pages without a backend server,
 *    gracefully falls back to browser-level localStorage persistence and local offline AI guidance so all features work seamlessly.
 */

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

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Seed initial demo data for client-side GitHub Pages storage if empty
const defaultSuppliers: SupplierListing[] = [
  {
    id: 1,
    name: 'Matutum Agri-Packaging Solutions',
    category: 'packaging',
    location: 'Polomolok, South Cotabato',
    products: 'Corrugated boxes, eco-friendly banana leaves trays, vacuum pouches for dried fruit',
    publicEmail: 'inquiries@matutumpackaging.example.ph',
    publicPhone: '+63 83 228 4101',
    website: 'https://matutumpackaging.example.ph',
    verifiedAt: '2026-10-15T08:00:00Z',
    averageRating: 4.9,
    reviewCount: 14
  },
  {
    id: 2,
    name: 'South Cotabato Coffee Producers Hub',
    category: 'raw-materials',
    location: 'Tupi, South Cotabato',
    products: 'Green coffee beans, roasted Arabica and Robusta, processing equipment rentals',
    publicEmail: 'sales@sotcotcoffee.example.ph',
    publicPhone: '+63 917 555 3821',
    website: 'https://sotcotcoffee.example.ph',
    verifiedAt: '2026-10-18T09:30:00Z',
    averageRating: 5.0,
    reviewCount: 22
  },
  {
    id: 3,
    name: 'Koronadal Digital Marketing & Media',
    category: 'marketing',
    location: 'City of Koronadal',
    products: 'Social media management, DTI brand registration packages, product photography',
    publicEmail: 'support@koronadaldigital.example.ph',
    publicPhone: '+63 83 228 9942',
    website: 'https://koronadaldigital.example.ph',
    verifiedAt: '2026-10-20T11:00:00Z',
    averageRating: 4.8,
    reviewCount: 9
  },
  {
    id: 4,
    name: 'Sebu Artisanal Weaving Cooperative',
    category: 'raw-materials',
    location: 'Lake Sebu, South Cotabato',
    products: 'T’nalak abaca textile, natural dye extracts, brassware hardware for bags',
    publicEmail: 'order@lake-sebu-tnalak.example.ph',
    publicPhone: '+63 920 441 8892',
    website: 'https://lake-sebu-tnalak.example.ph',
    verifiedAt: '2026-10-22T14:15:00Z',
    averageRating: 5.0,
    reviewCount: 31
  },
  {
    id: 5,
    name: 'Surallah Cold Chain & Logistics',
    category: 'services',
    location: 'Surallah, South Cotabato',
    products: 'Temperature-controlled van delivery across SOCCSKSARGEN, pallet storage',
    publicEmail: 'dispatch@surallahlogistics.example.ph',
    publicPhone: '+63 83 238 1234',
    website: 'https://surallahlogistics.example.ph',
    verifiedAt: '2026-10-25T16:00:00Z',
    averageRating: 4.7,
    reviewCount: 18
  }
];

const defaultReviews: Record<number, SupplierReview[]> = {
  1: [
    {
      id: 101,
      supplierId: 1,
      reviewerName: 'Ramon Castillo',
      reviewerBusiness: 'Highland Berry Farm (Tupi)',
      rating: 5,
      reviewText: 'Their corrugated boxes protected our fresh strawberry dispatches to Davao with zero crushing. Very responsive team!',
      verifiedTransaction: 1,
      createdAt: '2026-10-28T10:00:00Z'
    },
    {
      id: 102,
      supplierId: 1,
      reviewerName: 'Grace Alcantara',
      reviewerBusiness: 'Polomolok Dried Fruits',
      rating: 5,
      reviewText: 'High quality food-grade vacuum pouches complying with FDA labeling standards. Essential partner for our exports.',
      verifiedTransaction: 1,
      createdAt: '2026-11-01T14:30:00Z'
    }
  ],
  2: [
    {
      id: 201,
      supplierId: 2,
      reviewerName: 'Carlos M.',
      reviewerBusiness: 'Marbel Artisan Cafe',
      rating: 5,
      reviewText: 'Consistently 84+ cupping score for Mt. Matutum Arabica beans. Prompt delivery and fair trade pricing.',
      verifiedTransaction: 1,
      createdAt: '2026-10-30T09:15:00Z'
    }
  ],
  3: [
    {
      id: 301,
      supplierId: 3,
      reviewerName: 'Maria Theresa Santos',
      reviewerBusiness: 'Santos Organics Koronadal',
      rating: 5,
      reviewText: 'Helped us redesign our product packaging and registered our trade trademark logo with DTI efficiently.',
      verifiedTransaction: 1,
      createdAt: '2026-11-02T16:45:00Z'
    }
  ],
  4: [
    {
      id: 401,
      supplierId: 4,
      reviewerName: 'Aida Morales',
      reviewerBusiness: 'Mindanao Heritage Souvenirs',
      rating: 5,
      reviewText: 'Genuine handwoven T’nalak blessed by cultural masters in Lake Sebu. Our European buyers loved the authenticity.',
      verifiedTransaction: 1,
      createdAt: '2026-11-03T11:20:00Z'
    }
  ],
  5: [
    {
      id: 501,
      supplierId: 5,
      reviewerName: 'Danilo Cruz',
      reviewerBusiness: 'Surallah Agri-Fishery Guild',
      rating: 5,
      reviewText: 'Kept our cold storage tilapia fillets in perfect frozen state during transit to General Santos fish port.',
      verifiedTransaction: 1,
      createdAt: '2026-11-04T08:00:00Z'
    }
  ]
};

const defaultTickets: EfilingTicket[] = [
  {
    id: 1,
    trackingNumber: 'EF-SC-2026-8812',
    businessName: 'Matutum Highlands Roastery',
    businessType: 'Sole Proprietorship',
    municipality: 'Tupi',
    filingStage: "Mayor's Permit / BPLO",
    status: 'Under Inspection',
    priority: 'expedited',
    locationSketchDesc: 'Poblacion National Highway, adjacent to Tupi Fruit Market, fronting municipal agriculture post.',
    documents: ['DTI-BNRS-Certificate.pdf', 'Barangay-Clearance-Tupi.pdf', 'Sanitary-Health-Cards.pdf'],
    notes: 'Sanitary inspection scheduled with Tupi Municipal Health Office on Thursday morning.',
    assignedAgent: 'DTI Negosyo Center Tupi Desk',
    createdAt: '2026-10-29T08:15:00Z',
    updatedAt: '2026-11-02T14:20:00Z'
  },
  {
    id: 2,
    trackingNumber: 'EF-SC-2026-9041',
    businessName: 'Lake Sebu Loomweavers Artisans',
    businessType: 'Barangay Micro-Business (BMBE)',
    municipality: 'Lake Sebu',
    filingStage: 'Business Name',
    status: 'Approved',
    priority: 'standard',
    locationSketchDesc: 'Sitio Tukoblog, Barangay Poblacion, Lake Sebu near Tourism Cultural Office.',
    documents: ['DTI-BNRS-Scope-Provincial.pdf', 'NCIP-Endorsement-Clearance.pdf'],
    notes: 'DTI BNRS Certificate issued for Provincial Scope (South Cotabato). Now applying for BMBE tax exemption.',
    assignedAgent: 'DTI Provincial MSMEDC Desk',
    createdAt: '2026-10-25T11:30:00Z',
    updatedAt: '2026-10-27T16:00:00Z'
  },
  {
    id: 3,
    trackingNumber: 'EF-SC-2026-9214',
    businessName: 'Koronadal Eco-Pack Logistics',
    businessType: 'Corporation',
    municipality: 'City of Koronadal',
    filingStage: 'Location & Zoning',
    status: 'Submitted to LGU',
    priority: 'urgent_renewal',
    locationSketchDesc: 'Block 4 Lot 9, General Santos Drive, Barangay Morales, Koronadal City.',
    documents: ['SEC-Certificate.pdf', 'Zoning-Clearance-Form.pdf', 'Barangay-Morales-Clearance.pdf'],
    notes: 'City Planning & Development Coordinator currently reviewing commercial setback guidelines.',
    assignedAgent: 'Koronadal City BPLO Liaison',
    createdAt: '2026-11-01T09:00:00Z',
    updatedAt: '2026-11-03T10:10:00Z'
  }
];

const defaultMessages: SupplierMessage[] = [
  {
    id: 1,
    supplierId: 1,
    supplierName: 'Matutum Agri-Packaging Solutions',
    subject: 'Bulk quotation for 1,500 corrugated boxes with custom print',
    message: 'Hello Ms. Elena, we are looking to procure 1,500 food-grade boxes for our upcoming harvest dispatch in Tupi. Do you offer sample prints?',
    status: 'replied',
    reply: 'Mabuhay! Yes, we offer free sample mockups. Minimum lead time is 4 days. Please share your box dimensions!',
    createdAt: '2026-11-02T13:40:00Z'
  }
];

const referenceSources = [
  { label: 'DTI Business Name Registration System (BNRS)', url: 'https://bnrs.dti.gov.ph/' },
  { label: 'Bureau of Internal Revenue (BIR)', url: 'https://www.bir.gov.ph/' },
  { label: 'DOST Regional Office 12 (SETUP)', url: 'https://region12.dost.gov.ph/' },
  { label: 'Small Business Corporation (SBCorp)', url: 'https://sbcorp.gov.ph/' },
  { label: 'South Cotabato Provincial Services', url: 'https://southcotabato.gov.ph/services/' },
  { label: 'City Government of Koronadal', url: 'https://koronadal.gov.ph/' }
];

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const fullUrl = `${API_BASE}${endpoint}`;

  try {
    const res = await fetch(fullUrl, {
      ...options,
      credentials: API_BASE ? 'include' : 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok || (contentType.includes('application/json') && res.status !== 404)) {
      return res;
    }

    if (res.status === 404 || contentType.includes('text/html')) {
      return handleClientFallback(endpoint, options);
    }

    return res;
  } catch {
    return handleClientFallback(endpoint, options);
  }
}

/** In-browser storage fallback when running on static hosts like GitHub Pages */
function handleClientFallback(endpoint: string, options: RequestInit): Response {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body as string) : {};

  // 1. Health
  if (endpoint === '/api/health') {
    return makeResponse(200, { ok: true, emailConfigured: false, mode: 'github-pages-client' });
  }

  // 2. Auth: Register
  if (endpoint === '/api/auth/register' && method === 'POST') {
    const users = JSON.parse(localStorage.getItem('enterseed_users') || '[]');
    const existing = users.find((u: any) => u.email.toLowerCase() === body.email.toLowerCase());
    if (existing) {
      return makeResponse(409, { error: 'An account with this email already exists.' });
    }
    const newUser = {
      id: Date.now(),
      email: body.email.toLowerCase(),
      firstName: body.firstName,
      lastName: body.lastName,
      business: body.business,
      preferredLanguage: ''
    };
    users.push(newUser);
    localStorage.setItem('enterseed_users', JSON.stringify(users));
    localStorage.setItem('enterseed_current_user', JSON.stringify(newUser));
    return makeResponse(201, {
      user: newUser,
      needsLanguageSelection: true,
      sessionToken: `ghpages-${Date.now()}`
    });
  }

  // 3. Auth: Login
  if (endpoint === '/api/auth/login' && method === 'POST') {
    const users = JSON.parse(localStorage.getItem('enterseed_users') || '[]');
    const user = users.find((u: any) => u.email.toLowerCase() === body.email.toLowerCase()) || {
      id: Date.now(),
      email: body.email,
      firstName: 'MSME',
      lastName: 'Owner',
      business: 'Local Enterprise (South Cotabato)',
      preferredLanguage: 'en'
    };
    localStorage.setItem('enterseed_current_user', JSON.stringify(user));
    return makeResponse(200, {
      user,
      needsLanguageSelection: !user.preferredLanguage,
      sessionToken: `ghpages-${Date.now()}`
    });
  }

  // 4. Auth: Me
  if (endpoint === '/api/auth/me') {
    const user = JSON.parse(localStorage.getItem('enterseed_current_user') || 'null');
    if (user) {
      return makeResponse(200, { user });
    }
    return makeResponse(401, { error: 'Please log in to continue.' });
  }

  // 5. Auth: Language
  if (endpoint === '/api/auth/language' && method === 'PATCH') {
    const user = JSON.parse(localStorage.getItem('enterseed_current_user') || 'null');
    if (user) {
      user.preferredLanguage = body.language;
      localStorage.setItem('enterseed_current_user', JSON.stringify(user));
    }
    return makeResponse(200, { preferredLanguage: body.language });
  }

  // 6. Auth: Logout
  if (endpoint === '/api/auth/logout') {
    localStorage.removeItem('enterseed_current_user');
    return new Response(null, { status: 204 });
  }

  // 7. Finance: Get assessment
  if (endpoint === '/api/finance/assessment' && method === 'GET') {
    const saved = localStorage.getItem('enterseed_finance_assessment');
    return makeResponse(200, { assessment: saved ? JSON.parse(saved) : null });
  }

  // 8. Finance: Save assessment
  if (endpoint === '/api/finance/assessment' && method === 'PUT') {
    localStorage.setItem('enterseed_finance_assessment', JSON.stringify({ ...body, updatedAt: new Date().toISOString() }));
    return makeResponse(200, { saved: true });
  }

  // 9. Finance: Delete assessment
  if (endpoint === '/api/finance/assessment' && method === 'DELETE') {
    localStorage.removeItem('enterseed_finance_assessment');
    return new Response(null, { status: 204 });
  }

  // === MODULE A: E-FILING TICKETS ===
  if (endpoint === '/api/efiling/tickets' && method === 'GET') {
    const stored = JSON.parse(localStorage.getItem('enterseed_efiling_tickets') || 'null');
    const tickets = stored || defaultTickets;
    return makeResponse(200, { tickets });
  }

  if (endpoint === '/api/efiling/tickets' && method === 'POST') {
    const currentUser = JSON.parse(localStorage.getItem('enterseed_current_user') || '{}');
    const adminKey = localStorage.getItem('enterseed_admin_key');
    if (currentUser.role === 'admin' || Boolean(adminKey)) {
      return makeResponse(403, {
        error: 'Role-Based Access Control: Admin accounts are restricted from creating or submitting e-filings. E-filing creation is strictly reserved for verified MSME Business Owners.'
      });
    }
    const stored = JSON.parse(localStorage.getItem('enterseed_efiling_tickets') || 'null') || defaultTickets;
    const now = new Date().toISOString();
    const newTicket: EfilingTicket = {
      id: Date.now(),
      trackingNumber: `EF-SC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      businessName: body.businessName,
      businessType: body.businessType,
      municipality: body.municipality,
      filingStage: body.filingStage,
      status: body.status || 'Draft',
      priority: body.priority || 'standard',
      locationSketchDesc: body.locationSketchDesc || '',
      documents: body.documents || ['DTI-BNRS-Application.pdf'],
      notes: body.notes || 'Created via digital multi-client filing desk.',
      assignedAgent: 'DTI Negosyo Center Desk',
      createdAt: now,
      updatedAt: now
    };
    stored.unshift(newTicket);
    localStorage.setItem('enterseed_efiling_tickets', JSON.stringify(stored));
    return makeResponse(201, { ticket: newTicket });
  }

  if (endpoint.startsWith('/api/efiling/tickets/') && method === 'PATCH') {
    const id = Number(endpoint.split('/').pop());
    const stored = JSON.parse(localStorage.getItem('enterseed_efiling_tickets') || 'null') || defaultTickets;
    const ticket = stored.find((t: EfilingTicket) => t.id === id);
    if (!ticket) return makeResponse(404, { error: 'Ticket not found' });
    if (body.status) ticket.status = body.status;
    if (body.filingStage) ticket.filingStage = body.filingStage;
    if (body.notes) ticket.notes = body.notes;
    ticket.updatedAt = new Date().toISOString();
    localStorage.setItem('enterseed_efiling_tickets', JSON.stringify(stored));
    return makeResponse(200, { ticket });
  }

  if (endpoint.startsWith('/api/efiling/tickets/') && method === 'DELETE') {
    const id = Number(endpoint.split('/').pop());
    let stored = JSON.parse(localStorage.getItem('enterseed_efiling_tickets') || 'null') || defaultTickets;
    stored = stored.filter((t: EfilingTicket) => t.id !== id);
    localStorage.setItem('enterseed_efiling_tickets', JSON.stringify(stored));
    return new Response(null, { status: 204 });
  }

  // === MODULE A: SMART REFERRAL ENGINE ===
  if (endpoint === '/api/referrals/subsidy-check' && method === 'POST') {
    const matches = evaluateSubsidies(body);
    return makeResponse(200, { matches });
  }

  if (endpoint === '/api/referrals/credit-match' && method === 'POST') {
    const matches = evaluateCredit(body);
    return makeResponse(200, { matches });
  }

  // === MODULE A: AUTOMATED DOCUMENT GENERATION ===
  if (endpoint === '/api/ai/generate-doc' && method === 'POST') {
    const user = JSON.parse(localStorage.getItem('enterseed_current_user') || '{}');
    const docTypeLabels: Record<string, string> = {
      feasibility_study: 'Feasibility Study & Commercial Viability Assessment',
      business_plan: 'Comprehensive MSME Business Plan',
      grant_loan_proposal: 'Small Business Grant & Credit Financing Proposal'
    };
    const title = `${docTypeLabels[body.docType] || 'Business Document'} — ${body.businessName} (${body.municipality})`;
    const annualRev = (body.monthlyRevenue || 80000) * 12;
    const paybackMonths = calculatePaybackPeriod(body.requestedAmount || 0, body.monthlyRevenue || 80000);

    const contentHtml = `
      <div class="doc-container p-6 sm:p-10 font-sans text-slate-800 bg-white">
        <div class="border-b-2 border-purple-900 pb-4 mb-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs font-bold uppercase tracking-widest text-purple-900">Republic of the Philippines · Province of South Cotabato</p>
              <h1 class="text-2xl font-extrabold text-slate-900 mt-1">${title}</h1>
              <p class="text-xs text-slate-500 mt-0.5">DTI Negosyo Center Support Hub · Proponent: ${user.firstName || 'MSME'} ${user.lastName || 'Owner'}</p>
            </div>
            <div class="text-right text-xs text-slate-500">
              <p><strong>Tracking No:</strong> DOC-SC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}</p>
              <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
        </div>

        <section class="mb-6">
          <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">1. Executive Summary & Purpose</h2>
          <p class="text-sm leading-relaxed mb-3">
            <strong>${body.businessName}</strong> is an enterprise established within <strong>${body.municipality}, South Cotabato</strong>, operating in the <strong>${body.sector}</strong> sector. This document formalizes operational scaling, market capture, and financial feasibility for statutory registration and institutional credit evaluation.
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg text-xs border border-slate-200">
            <div><span class="text-slate-500 block">Municipality:</span><strong>${body.municipality}, South Cotabato</strong></div>
            <div><span class="text-slate-500 block">Sector:</span><strong>${body.sector}</strong></div>
            <div><span class="text-slate-500 block">Capital Plan:</span><strong>₱${Number(body.requestedAmount || 0).toLocaleString()}</strong></div>
            <div><span class="text-slate-500 block">Projected Annual Sales:</span><strong>₱${annualRev.toLocaleString()}</strong></div>
          </div>
        </section>

        <section class="mb-6">
          <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">2. Regulatory Classification & Compliance</h2>
          <p class="text-sm leading-relaxed mb-2">
            The enterprise operates under Republic Act No. 9178 (Barangay Micro Business Enterprises Act) and Republic Act No. 11032 (Ease of Doing Business Act). Filings in progress include DTI BNRS, Barangay Clearance, Mayor’s Permit, and BIR Form 1901.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">3. Target Market & Competitive Strategy</h2>
          <p class="text-sm leading-relaxed mb-2">
            <strong>Target Market:</strong> ${body.targetMarket}.
          </p>
          <p class="text-sm leading-relaxed">
            South Cotabato provides strategic logistic connectivity through the Makar Wharf seaport and General Santos City airport corridor, supporting both retail consumer demand and institutional bulk off-takers across Region 12.
          </p>
        </section>

        <section class="mb-6">
          <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">4. Supply Chain Integration</h2>
          <p class="text-sm leading-relaxed mb-2">
            <strong>Local Sourcing:</strong> ${body.supplyChainNotes || 'Integrated with verified South Cotabato packaging and agricultural hubs in Polomolok, Tupi, and Koronadal.'}
          </p>
        </section>

        <section class="mb-6">
          <h2 class="text-lg font-bold text-purple-900 border-b border-purple-100 pb-1 mb-2">5. 3-Year Financial Projections</h2>
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
                <td class="p-2 font-medium">Gross Turnover</td>
                <td class="p-2 text-right">₱${annualRev.toLocaleString()}</td>
                <td class="p-2 text-right">₱${Math.round(annualRev * 1.18).toLocaleString()}</td>
                <td class="p-2 text-right">₱${Math.round(annualRev * 1.475).toLocaleString()}</td>
              </tr>
              <tr class="border-b border-slate-200 bg-slate-50">
                <td class="p-2 font-medium">Cost of Sales (48%)</td>
                <td class="p-2 text-right">₱${Math.round(annualRev * 0.48).toLocaleString()}</td>
                <td class="p-2 text-right">₱${Math.round(annualRev * 1.18 * 0.46).toLocaleString()}</td>
                <td class="p-2 text-right">₱${Math.round(annualRev * 1.475 * 0.45).toLocaleString()}</td>
              </tr>
              <tr class="bg-purple-50 font-bold text-purple-900">
                <td class="p-2">Net Operating Surplus (28%)</td>
                <td class="p-2 text-right">₱${Math.round(annualRev * 0.28).toLocaleString()}</td>
                <td class="p-2 text-right">₱${Math.round(annualRev * 1.18 * 0.31).toLocaleString()}</td>
                <td class="p-2 text-right">₱${Math.round(annualRev * 1.475 * 0.33).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <p class="text-xs text-slate-500">
            Payback estimation: <strong>${paybackMonths} months</strong> based on retained operational surplus.
          </p>
        </section>
      </div>
    `;

    const newDoc: GeneratedDocument = {
      id: Date.now(),
      docType: body.docType,
      title,
      businessName: body.businessName,
      municipality: body.municipality,
      contentHtml,
      summary: {
        businessName: body.businessName,
        municipality: body.municipality,
        sector: body.sector,
        projectedRevenue: annualRev,
        paybackMonths
      },
      createdAt: new Date().toISOString()
    };

    if (body.saveToLibrary) {
      const storedDocs = JSON.parse(localStorage.getItem('enterseed_generated_docs') || '[]');
      storedDocs.unshift(newDoc);
      localStorage.setItem('enterseed_generated_docs', JSON.stringify(storedDocs));
    }

    return makeResponse(201, { document: newDoc });
  }

  if (endpoint === '/api/ai/save-doc' && method === 'POST') {
    const doc: GeneratedDocument = body.doc || body;
    const storedDocs = JSON.parse(localStorage.getItem('enterseed_generated_docs') || '[]');
    const existingIndex = storedDocs.findIndex((d: any) => d.id === doc.id);
    if (existingIndex >= 0) {
      storedDocs[existingIndex] = doc;
    } else {
      storedDocs.unshift(doc);
    }
    localStorage.setItem('enterseed_generated_docs', JSON.stringify(storedDocs));
    return makeResponse(200, { success: true, document: doc });
  }

  if (endpoint === '/api/ai/documents' && method === 'GET') {
    const storedDocs = JSON.parse(localStorage.getItem('enterseed_generated_docs') || '[]');
    return makeResponse(200, { documents: storedDocs });
  }

  // === MODULE B: SUPPLIERS, REVIEWS & MESSAGING ===
  if (endpoint === '/api/suppliers' && method === 'GET') {
    const stored = JSON.parse(localStorage.getItem('enterseed_suppliers') || 'null');
    const suppliers = stored || defaultSuppliers;
    return makeResponse(200, { suppliers });
  }

  if (endpoint.includes('/reviews') && method === 'GET') {
    const supplierId = Number(endpoint.split('/')[3]);
    const storedReviews = JSON.parse(localStorage.getItem('enterseed_supplier_reviews') || 'null') || defaultReviews;
    const reviews = storedReviews[supplierId] || [];
    return makeResponse(200, { reviews });
  }

  if (endpoint.includes('/reviews') && method === 'POST') {
    const supplierId = Number(endpoint.split('/')[3]);
    const storedReviews = JSON.parse(localStorage.getItem('enterseed_supplier_reviews') || 'null') || defaultReviews;
    const user = JSON.parse(localStorage.getItem('enterseed_current_user') || '{}');
    const newReview: SupplierReview = {
      id: Date.now(),
      supplierId,
      reviewerName: `${user.firstName || 'Verified'} ${user.lastName || 'MSME'}`.trim(),
      reviewerBusiness: user.business || 'South Cotabato Enterprise',
      rating: body.rating,
      reviewText: body.reviewText,
      verifiedTransaction: 1,
      createdAt: new Date().toISOString()
    };
    if (!storedReviews[supplierId]) storedReviews[supplierId] = [];
    storedReviews[supplierId].unshift(newReview);
    localStorage.setItem('enterseed_supplier_reviews', JSON.stringify(storedReviews));
    return makeResponse(201, { success: true });
  }

  if (endpoint === '/api/suppliers/messages' && method === 'GET') {
    const stored = JSON.parse(localStorage.getItem('enterseed_supplier_messages') || 'null');
    const messages = stored || defaultMessages;
    return makeResponse(200, { messages });
  }

  if (endpoint.endsWith('/messages') && method === 'POST') {
    const supplierId = Number(endpoint.split('/')[3]);
    const storedSuppliers = JSON.parse(localStorage.getItem('enterseed_suppliers') || 'null') || defaultSuppliers;
    const supplier = storedSuppliers.find((s: any) => s.id === supplierId);
    const stored = JSON.parse(localStorage.getItem('enterseed_supplier_messages') || 'null') || defaultMessages;
    const newMsg: SupplierMessage = {
      id: Date.now(),
      supplierId,
      supplierName: supplier?.name || 'Local South Cotabato Supplier',
      subject: body.subject,
      message: body.message,
      status: 'sent',
      createdAt: new Date().toISOString()
    };
    stored.unshift(newMsg);
    localStorage.setItem('enterseed_supplier_messages', JSON.stringify(stored));
    return makeResponse(201, { id: newMsg.id, success: true });
  }

  // 10. Boss Narra AI / Assistant
  if (endpoint.startsWith('/api/boss-nana') || endpoint.startsWith('/api/assistant')) {
    const q = (body.question || '').toLowerCase();
    const lang = body.language || 'en';

    // RAG Retrieval over saved Document Library in localStorage
    const savedDocs: GeneratedDocument[] = JSON.parse(localStorage.getItem('enterseed_generated_docs') || '[]');
    let ragSnippet = '';
    const activeSources: Array<{ label: string; url: string }> = [];

    if (savedDocs.length > 0) {
      const matchingDoc = savedDocs.find(
        (doc) =>
          doc.title.toLowerCase().includes(q) ||
          doc.businessName.toLowerCase().includes(q) ||
          doc.municipality.toLowerCase().includes(q) ||
          (doc.summary?.sector && doc.summary.sector.toLowerCase().includes(q))
      ) || savedDocs[0];

      if (matchingDoc) {
        ragSnippet = `\n\n[Retrieved Context from ${matchingDoc.title}]: Based on your saved Document Library file, your enterprise in ${matchingDoc.municipality} is structured under ${matchingDoc.summary?.sector || 'MSME sector'} with an estimated payback period of ${matchingDoc.summary?.paybackMonths || 'N/A'} months.`;
        activeSources.push({
          label: `Document Library: ${matchingDoc.title}`,
          url: '#documents'
        });
      }
    }

    let answer = 'I can help guide you on business registration, permits, financing, and supply chains across South Cotabato. You can file tickets or check grants in the hub.';
    if (/dti|business name|registration|rehistro/i.test(q)) {
      answer = lang === 'fil'
        ? 'Para sa pagpaparehistro ng business name (sole proprietorship), gamitin ang opisyal na DTI BNRS portal o lumikha ng ticket sa E-Filing Hub. Maghanda ng 1 valid ID at fee (₱200-₱2,000).'
        : 'For sole proprietorship business name registration, access DTI BNRS or create an e-filing ticket right here. Prepare a valid government ID and registration fees based on territorial scope.';
      activeSources.push({ label: 'DTI BNRS Portal', url: 'https://bnrs.dti.gov.ph/' });
    } else if (/bir|tax|buwis/i.test(q)) {
      answer = lang === 'fil'
        ? 'Magrehistro sa BIR gamit ang Form 1901 para sa self-employed o negosyo. Maaaring pumili ng 8% gross income tax kung ang taunang benta ay mas mababa sa ₱3,000,000.'
        : 'Register with the BIR using Form 1901 for self-employed/single proprietors. You may avail of the 8% preferential gross income tax option if gross sales do not exceed ₱3,000,000.';
      activeSources.push({ label: 'BIR Official Portal', url: 'https://www.bir.gov.ph/' });
    } else if (/permit|mayor|lgu|koronadal|tupi|surallah/i.test(q)) {
      answer = lang === 'fil'
        ? 'Kailangan ng Barangay Business Clearance, Sanitary Permit, at Fire Inspection Certificate (FSIC) bago maibigay ang Mayor’s Permit sa Business Permits and Licensing Office (BPLO).'
        : 'A Barangay Business Clearance, Sanitary Permit, and Fire Safety Inspection Certificate (FSIC) are required prior to issuance of the Mayor’s Permit by the City/Municipal BPLO.';
      activeSources.push({ label: 'City of Koronadal Portal', url: 'https://koronadal.gov.ph/' });
      activeSources.push({ label: 'South Cotabato Services', url: 'https://southcotabato.gov.ph/services/' });
    } else if (/loan|bank|capital|pondo|sbcorp|landbank/i.test(q)) {
      answer = lang === 'fil'
        ? 'Subukan ang Credit Matcher tool sa Hub! Ang SBCorp RISE UP ay may 1% buwanang interes na walang kolateral para sa micro loans, at ang LandBank Koronadal ay may 5-6.5% kada taon.'
        : 'Try our Credit Matcher tool in the E-Filing & Advisory Hub! SBCorp RISE UP offers 1% monthly interest with no collateral for micro loans, while LandBank Koronadal provides 5-6.5% annual financing.';
      activeSources.push({ label: 'SBCorp Financing Portal', url: 'https://sbcorp.gov.ph/' });
    } else {
      activeSources.push(...referenceSources.slice(0, 3));
    }

    answer += ragSnippet;

    return makeResponse(200, {
      answer,
      mode: 'grounded-local-orientation',
      sources: activeSources
    });
  }

  // 12. Suppliers: Apply
  if (endpoint === '/api/supplier-applications' && method === 'POST') {
    const apps = JSON.parse(localStorage.getItem('enterseed_supplier_applications') || '[]');
    apps.push({ ...body, id: Date.now(), createdAt: new Date().toISOString() });
    localStorage.setItem('enterseed_supplier_applications', JSON.stringify(apps));
    return makeResponse(201, { received: true, status: 'pending_review', retentionDays: 90 });
  }

  // 14. Readiness: Submit
  if (endpoint === '/api/readiness' && method === 'POST') {
    return makeResponse(201, { received: true, deleteToken: `token-${Date.now()}`, retentionDays: 30 });
  }

  // 15. Inquiries: Submit
  if (endpoint === '/api/inquiries' && method === 'POST') {
    const inqs = JSON.parse(localStorage.getItem('enterseed_inquiries') || '[]');
    inqs.push({ ...body, id: Date.now(), createdAt: new Date().toISOString() });
    localStorage.setItem('enterseed_inquiries', JSON.stringify(inqs));
    return makeResponse(201, { received: true, reference: Date.now(), retentionDays: 180 });
  }

  // 16. Admin Endpoints
  if (endpoint.startsWith('/api/admin')) {
    const apps = JSON.parse(localStorage.getItem('enterseed_supplier_applications') || '[]');
    const storedSuppliers = JSON.parse(localStorage.getItem('enterseed_suppliers') || 'null') || defaultSuppliers;
    const inqs = JSON.parse(localStorage.getItem('enterseed_inquiries') || '[]');

    if (endpoint === '/api/admin/supplier-applications') {
      return makeResponse(200, { applications: apps });
    }
    if (endpoint === '/api/admin/suppliers') {
      return makeResponse(200, { suppliers: storedSuppliers });
    }
    if (endpoint === '/api/admin/inquiries') {
      return makeResponse(200, { inquiries: inqs });
    }
    if (endpoint.includes('/approve')) {
      return makeResponse(201, { approved: true, supplierId: Date.now(), verifiedAt: new Date().toISOString() });
    }
  }

  return makeResponse(200, { ok: true });
}

function makeResponse(status: number, data: any): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Enterseed-Mode': 'client-storage-adapter'
    }
  });
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
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

export async function fetchSupplierReviews(supplierId: number): Promise<SupplierReview[]> {
  const res = await apiFetch(`/api/suppliers/${supplierId}/reviews`);
  if (!res.ok) return [];
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
  if (!res.ok) return [];
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
