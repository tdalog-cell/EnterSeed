import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/apiClient';
import { ActivePage } from '../components/AppShell';
import { PhotoImg } from '../components/PhotoImg';
import { Button, Panel, PanelHeader, Stat, cx, formatPesos } from '../components/ui';
import { PHOTOS } from '../photos';
import { ArrowRight, ArrowUpRight, FileText, Store } from 'lucide-react';

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
    title: 'DTI business name',
    desc: 'Register your sole proprietorship name for barangay, city, regional, or national scope.',
    link: { label: 'BNRS portal', href: 'https://bnrs.dti.gov.ph/' }
  },
  {
    title: 'Barangay clearance',
    desc: 'Get a commercial clearance from your barangay hall in Koronadal, Polomolok, or your town.',
    link: null
  },
  {
    title: 'Mayor’s permit (BPLO)',
    desc: 'Apply for the city or municipal business permit, with fire and sanitary inspections.',
    link: { label: 'Provincial services', href: 'https://southcotabato.gov.ph/services/' }
  },
  {
    title: 'BIR registration',
    desc: 'Form 1901, TIN, books of accounts, and authority to print official receipts.',
    link: { label: 'BIR eServices', href: 'https://www.bir.gov.ph/' }
  }
];

export const DashboardView: React.FC<{ setActivePage: (page: ActivePage) => void }> = ({ setActivePage }) => {
  const { user, token } = useAuth();
  const [assessment, setAssessment] = useState<FinanceAssessmentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await apiFetch('/api/finance/assessment', { headers });
        if (res.ok) {
          const data = await res.json();
          setAssessment(data.assessment || null);
        }
      } catch (err) {
        console.warn('Could not load assessment:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAssessment();
  }, [token]);

  const operatingProfit = assessment ? assessment.monthlyIncome - assessment.monthlyExpenses : 0;
  const monthlyOutflows = assessment ? assessment.monthlyExpenses + assessment.monthlyDebtPayment : 0;
  const cashRunway = assessment && monthlyOutflows > 0 ? `${(assessment.cashOnHand / monthlyOutflows).toFixed(1)} mo` : '—';

  const tools = [
    {
      page: 'marketing' as ActivePage,
      icon: Store,
      title: 'Find a reviewed supplier',
      desc: 'Packaging, raw materials, and logistics partners across South Cotabato, on a map.'
    },
    {
      page: 'documents' as ActivePage,
      icon: FileText,
      title: 'Draft a business plan',
      desc: 'A structured outline or feasibility study to bring to your lender or cooperative.'
    }
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome */}
      <section className="overflow-hidden rounded-2xl bg-night text-white grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <PhotoImg
          photo={PHOTOS.planting}
          sizes="(min-width: 768px) 50vw, 100vw"
          className="h-48 sm:h-60 md:h-auto md:min-h-[300px] md:order-2"
          eager
        />
        <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <h1 className="text-[1.75rem] sm:text-4xl font-extrabold tracking-tight leading-tight">
            {user?.firstName ? `Mabuhay, ${user.firstName}!` : 'Mabuhay!'}
          </h1>
          {user?.business && <p className="mt-2 text-[15px] text-white/75">{user.business}</p>}
          <p className="mt-4 text-[15px] leading-relaxed text-white/85 max-w-md">
            {assessment
              ? 'Your finance checkup is saved. Update it monthly to keep your runway estimate honest.'
              : 'Start with a three-minute finance checkup. It shapes every recommendation Boss Narra gives you.'}
          </p>
          <div className="mt-6">
            <Button variant="accent" size="lg" onClick={() => setActivePage('finance')}>
              {assessment ? 'Review finance checkup' : 'Start finance checkup'}
              <ArrowRight />
            </Button>
          </div>
        </div>
      </section>

      {/* Finance snapshot */}
      <Panel>
        <PanelHeader
          title="Financial snapshot"
          description={assessment ? 'Self-reported monthly estimates. Verify against your ledgers before applying for financing.' : undefined}
          action={
            assessment && (
              <Button variant="ghost" size="sm" onClick={() => setActivePage('finance')}>
                Update
                <ArrowRight />
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
            <Stat label="Monthly income" value={formatPesos(assessment.monthlyIncome)} />
            <Stat label="Operating profit" value={formatPesos(operatingProfit)} tone={operatingProfit >= 0 ? 'good' : 'danger'} />
            <Stat label="Cash runway" value={cashRunway} tone="brand" />
            <Stat label="Outstanding debt" value={formatPesos(assessment.debtOutstanding)} />
          </dl>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-sunken px-5 py-5">
            <div>
              <p className="font-semibold text-ink">No checkup saved yet</p>
              <p className="mt-1 text-sm text-muted max-w-md">
                Enter income, expenses, cash, and debt to see your runway, debt load, and balance snapshot here.
              </p>
            </div>
            <Button onClick={() => setActivePage('finance')}>Start checkup</Button>
          </div>
        )}
      </Panel>

      {/* Tools */}
      <section aria-labelledby="tools-h">
        <h2 id="tools-h" className="sr-only">
          Tools
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {tools.map(({ page, icon: Icon, title, desc }) => (
            <li key={page}>
              <button
                type="button"
                onClick={() => setActivePage(page)}
                className="group w-full h-full text-left flex items-start gap-4 bg-surface rounded-2xl border border-line p-5 hover:border-brand/40 transition-colors"
              >
                <span className="w-10 h-10 shrink-0 rounded-xl bg-brand-soft text-brand flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 font-semibold text-ink group-hover:text-brand transition-colors">
                    {title}
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted">{desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Registration milestones */}
      <Panel>
        <PanelHeader
          title="Registration milestones"
          description="The usual order for registering a business in South Cotabato. Confirm current fees on each official site."
        />
        <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {MILESTONES.map((m, i) => (
            <li key={m.title} className="relative">
              <span
                className={cx(
                  'flex w-7 h-7 items-center justify-center rounded-full text-[13px] font-bold tnum',
                  'bg-accent-soft text-accent-ink'
                )}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold text-ink">{m.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{m.desc}</p>
              {m.link ? (
                <a
                  href={m.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                >
                  {m.link.label}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              ) : (
                <p className="mt-2 text-sm font-medium text-muted">At your barangay hall</p>
              )}
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
};
