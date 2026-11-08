import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, fetchTickets, EfilingTicket } from '../services/apiClient';
import { ActivePage } from '../components/AppShell';
import { PhotoImg } from '../components/PhotoImg';
import { Button, Panel, PanelHeader, Stat, cx, formatPesos } from '../components/ui';
import { PHOTOS } from '../photos';
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Store,
  FileCheck2,
  Sparkles,
  MapPin,
  CheckCircle2,
  Building2,
  Star,
  ShieldCheck
} from 'lucide-react';

interface FinanceAssessmentData {
  monthlyIncome: number;
  monthlyExpenses: number;
  cashOnHand: number;
  debtOutstanding: number;
  monthlyDebtPayment: number;
  otherAssets: number;
  otherLiabilities: number;
  taxStanding: string;
  updatedAt: string;
}

const MILESTONES = [
  {
    title: 'DTI Business Name (BNRS)',
    desc: 'Register sole proprietorship name for barangay, municipal, regional, or national scope.',
    link: { label: 'BNRS portal', href: 'https://bnrs.dti.gov.ph/' }
  },
  {
    title: 'Barangay Commercial Clearance',
    desc: 'Commercial clearance from your barangay hall in Koronadal, Polomolok, Tupi, or your town.',
    link: null
  },
  {
    title: 'Mayor’s Permit (BPLO)',
    desc: 'Municipal business permit with sanitary inspection, zoning sketch, and BFP fire safety certificate.',
    link: { label: 'Provincial services', href: 'https://southcotabato.gov.ph/services/' }
  },
  {
    title: 'BIR Form 1901 Registration',
    desc: 'TIN issuance, 8% gross income tax election, books of accounts, and Authority to Print (ATP).',
    link: { label: 'BIR eServices', href: 'https://www.bir.gov.ph/' }
  }
];

export const DashboardView: React.FC<{ setActivePage: (page: ActivePage) => void }> = ({ setActivePage }) => {
  const { user, token } = useAuth();
  const [assessment, setAssessment] = useState<FinanceAssessmentData | null>(null);
  const [tickets, setTickets] = useState<EfilingTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await apiFetch('/api/finance/assessment', { headers });
        if (res.ok) {
          const data = await res.json();
          setAssessment(data.assessment || null);
        }

        const tix = await fetchTickets();
        setTickets(tix);
      } catch (err) {
        console.warn('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const operatingProfit = assessment ? assessment.monthlyIncome - assessment.monthlyExpenses : 0;
  const monthlyOutflows = assessment ? assessment.monthlyExpenses + assessment.monthlyDebtPayment : 0;
  const cashRunway = assessment && monthlyOutflows > 0 ? `${(assessment.cashOnHand / monthlyOutflows).toFixed(1)} mo` : '—';

  const inInspectionCount = tickets.filter((t) => t.status === 'Under Inspection' || t.status === 'Submitted to LGU').length;
  const approvedCount = tickets.filter((t) => t.status === 'Approved').length;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 text-white grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] shadow-md border border-purple-800/40">
        <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 w-max mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            DTI Negosyo Center · Province of South Cotabato
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            {user?.firstName ? `Mabuhay, ${user.firstName}!` : 'Mabuhay!'}
          </h1>
          {user?.business && <p className="mt-1 text-base text-amber-200/90 font-medium">{user.business}</p>}
          <p className="mt-3 text-sm leading-relaxed text-purple-100/90 max-w-lg">
            Welcome to the DTI MSME Support Hub & Local Marketplace. File statutory registrations, match government subsidies, generate AI feasibility studies, and connect with verified local packaging & raw material suppliers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="accent" size="lg" onClick={() => setActivePage('efiling')}>
              <FileCheck2 className="w-5 h-5 mr-1" />
              Open E-Filing Hub
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setActivePage('marketing')} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <Store className="w-5 h-5 mr-1" />
              Supplier Network
            </Button>
          </div>
        </div>
        <PhotoImg
          photo={PHOTOS.planting}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="h-48 sm:h-60 md:h-auto md:min-h-[300px] object-cover"
          eager
        />
      </section>

      {/* Two Core Pillars Quick Launchpad */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module A: E-Filing & Advisory */}
        <div className="bg-surface border border-line rounded-2xl p-5 hover:border-brand/40 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                Module A · E-Filing & Advisory
              </span>
              <span className="text-xs text-muted font-mono">{tickets.length} Active Tickets</span>
            </div>
            <h3 className="text-lg font-bold text-ink mt-3">Multi-Client E-Filing & Smart Referral</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Unified digital workflow for DTI Business Name, Barangay Clearances, Mayor's Permit with location sketch, and algorithmic subsidy/credit matchmaking.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-sunken/60 border border-line/60">
                <span className="text-slate-500 block">In Inspection / LGU</span>
                <span className="font-extrabold text-blue-700 text-base">{inInspectionCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sunken/60 border border-line/60">
                <span className="text-slate-500 block">Approved Filings</span>
                <span className="font-extrabold text-emerald-700 text-base">{approvedCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-line flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActivePage('efiling')}
              className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
            >
              Manage Filing Tickets <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActivePage('documents')}
              className="text-xs font-semibold text-muted hover:text-ink inline-flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" /> AI Doc Studio
            </button>
          </div>
        </div>

        {/* Module B: Omnichannel Supplier Network */}
        <div className="bg-surface border border-line rounded-2xl p-5 hover:border-brand/40 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Module B · Supplier Network
              </span>
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" /> ★ 4.9 Trust Score
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink mt-3">Omnichannel Local Marketplace</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Searchable, categorized marketplace for South Cotabato across Raw Materials, Packaging, Intermediary/B2B Services, and Marketing Agencies with verified peer reviews.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-sunken/60 border border-line/60">
                <span className="text-slate-500 block">Verified Hub Suppliers</span>
                <span className="font-extrabold text-purple-900 text-base">5 Producers</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sunken/60 border border-line/60">
                <span className="text-slate-500 block">Municipal Coverage</span>
                <span className="font-extrabold text-ink text-base">All 11 Towns</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-line flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActivePage('marketing')}
              className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
            >
              Explore Supplier Directory <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActivePage('boss-nana')}
              className="text-xs font-semibold text-muted hover:text-ink inline-flex items-center gap-1"
            >
              <img src="./logos/Narra.png" alt="" className="w-3.5 h-3.5 object-contain" /> Ask Boss Narra
            </button>
          </div>
        </div>
      </div>

      {/* Financial Runway Snapshot */}
      <Panel>
        <PanelHeader
          title="Financial Health & Capital Runway"
          description={assessment ? 'Self-reported monthly estimates. Shapes your credit matching and government grant recommendations.' : undefined}
          action={
            assessment && (
              <Button variant="ghost" size="sm" onClick={() => setActivePage('finance')}>
                Update Checkup
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )
          }
        />

        {loading ? (
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="h-4 w-24 rounded bg-sunken" />
                <div className="mt-2 h-7 w-32 rounded bg-sunken" />
              </div>
            ))}
          </dl>
        ) : assessment ? (
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
            <Stat label="Monthly Turnover" value={formatPesos(assessment.monthlyIncome)} />
            <Stat label="Operating Surplus" value={formatPesos(operatingProfit)} tone={operatingProfit >= 0 ? 'good' : 'danger'} />
            <Stat label="Cash Runway" value={cashRunway} tone="brand" />
            <Stat label="Outstanding Liabilities" value={formatPesos(assessment.debtOutstanding)} />
          </dl>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-sunken px-5 py-5">
            <div>
              <p className="font-semibold text-ink">Take the 3-minute Financial Checkup</p>
              <p className="mt-1 text-sm text-muted max-w-md">
                Enter your monthly turnover, expenses, and cash reserves to calculate runway and unlock tailored credit matching.
              </p>
            </div>
            <Button onClick={() => setActivePage('finance')}>Start Finance Checkup</Button>
          </div>
        )}
      </Panel>

      {/* Statutory Milestones */}
      <Panel>
        <PanelHeader
          title="Statutory Business Registration Milestones"
          description="Mandatory sequencing for establishing an MSME in South Cotabato under RA 11032 Ease of Doing Business."
        />
        <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {MILESTONES.map((m, i) => (
            <li key={m.title} className="relative">
              <span
                className={cx(
                  'flex w-7 h-7 items-center justify-center rounded-full text-[13px] font-bold',
                  'bg-accent-soft text-accent-ink'
                )}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold text-ink text-sm">{m.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{m.desc}</p>
              {m.link ? (
                <a
                  href={m.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  {m.link.label}
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              ) : (
                <p className="mt-2 text-xs font-medium text-muted">At your municipal barangay hall</p>
              )}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
};
