import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, fetchTickets, EfilingTicket } from '../services/apiClient';
import { ActivePage } from '../components/AppShell';
import { PhotoImg } from '../components/PhotoImg';
import { Button, Panel, PanelHeader, Stat, Modal, cx, formatPesos, inputClass } from '../components/ui';
import { PHOTOS } from '../photos';
import { calculateFinancialHealth, FinancialCheckupResult } from '../utils/msmeLogic';
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Store,
  FileCheck2,
  Sparkles,
  MapPin,
  CheckCircle2,
  Star,
  ShieldCheck,
  Activity,
  ChevronRight,
  HelpCircle
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
    title: '1. DTI Business Name (BNRS)',
    desc: 'Register sole proprietorship name for barangay, municipal, regional, or national scope.',
    link: { label: 'BNRS portal', href: 'https://bnrs.dti.gov.ph/' }
  },
  {
    title: '2. Barangay Commercial Clearance',
    desc: 'Commercial clearance from your local barangay hall in Koronadal, Polomolok, Tupi, or your town.',
    link: null
  },
  {
    title: '3. Mayor’s Permit (BPLO)',
    desc: 'Municipal business permit with sanitary inspection, zoning sketch, and BFP fire safety certificate.',
    link: { label: 'Provincial services', href: 'https://southcotabato.gov.ph/services/' }
  },
  {
    title: '4. BIR Form 1901 Registration',
    desc: 'TIN issuance, 8% gross income tax election, official books of accounts, and Authority to Print (ATP).',
    link: { label: 'BIR eServices', href: 'https://www.bir.gov.ph/' }
  }
];

export const DashboardView: React.FC<{ setActivePage: (page: ActivePage) => void }> = ({ setActivePage }) => {
  const { user, token } = useAuth();
  const [assessment, setAssessment] = useState<FinanceAssessmentData | null>(null);
  const [tickets, setTickets] = useState<EfilingTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // Financial Checkup Wizard State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [salesInput, setSalesInput] = useState('180,000');
  const [expensesInput, setExpensesInput] = useState('110,000');
  const [debtInput, setDebtInput] = useState('15,000');
  const [cashInput, setCashInput] = useState('150,000');
  const [wizardResult, setWizardResult] = useState<FinancialCheckupResult | null>(null);
  const [savingAssessment, setSavingAssessment] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await apiFetch('/api/finance/assessment', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.assessment) {
            setAssessment(data.assessment);
            setSalesInput(data.assessment.monthlyIncome.toLocaleString('en-PH'));
            setExpensesInput(data.assessment.monthlyExpenses.toLocaleString('en-PH'));
            setDebtInput(data.assessment.monthlyDebtPayment.toLocaleString('en-PH'));
            setCashInput(data.assessment.cashOnHand.toLocaleString('en-PH'));
          }
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

  const parseNumber = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  };

  const handleStartCheckup = () => {
    setWizardStep(1);
    setWizardResult(null);
    setWizardOpen(true);
  };

  const handleComputeCheckup = () => {
    const sales = parseNumber(salesInput);
    const expenses = parseNumber(expensesInput);
    const debt = parseNumber(debtInput);
    const cash = parseNumber(cashInput);
    const res = calculateFinancialHealth(sales, expenses, debt, cash);
    setWizardResult(res);
    setWizardStep(4);
  };

  const handleSaveAssessment = async () => {
    setSavingAssessment(true);
    try {
      const sales = parseNumber(salesInput);
      const expenses = parseNumber(expensesInput);
      const debt = parseNumber(debtInput);
      const cash = parseNumber(cashInput);

      const payload = {
        monthlyIncome: sales,
        monthlyExpenses: expenses,
        cashOnHand: cash,
        debtOutstanding: debt * 12,
        monthlyDebtPayment: debt,
        otherAssets: 80000,
        otherLiabilities: 0,
        taxStanding: 'up_to_date'
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await apiFetch('/api/finance/assessment', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setAssessment(data.assessment);
        setWizardOpen(false);
      }
    } catch (e) {
      console.error('Error saving assessment:', e);
    } finally {
      setSavingAssessment(false);
    }
  };

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
            Built for South Cotabato MSMEs
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            {user?.firstName ? `Mabuhay, ${user.firstName}!` : 'Mabuhay!'}
          </h1>
          {user?.business && <p className="mt-1 text-base text-amber-200/90 font-medium">{user.business} · {user.municipality || 'City of Koronadal'}</p>}
          <p className="mt-3 text-sm leading-relaxed text-purple-100/90 max-w-lg">
            Welcome to Enterseed, an independent support tool for local entrepreneurs. Organize statutory registration requirements, find programs you may qualify for, draft business documents, and connect with South Cotabato suppliers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="accent" size="lg" onClick={() => setActivePage('efiling')}>
              <FileCheck2 className="w-5 h-5 mr-1" />
              Open Registration Assistant
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setActivePage('suppliers')} className="bg-white/10 text-white border-white/20 hover:bg-white/20">
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
        {/* Module A: Registration Assistant & Advisory */}
        <div className="bg-surface border border-line rounded-2xl p-5 hover:border-brand/40 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                Module A · Registration Assistant
              </span>
              <span className="text-xs text-muted flex items-center gap-1">
                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">Demo data</span>
                {tickets.length} Active Records
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink mt-3">Registration Preparation & Subsidy Matcher</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Step-by-step checklist preparation for DTI Business Name, Barangay Clearances, Mayor's Permit with site sketch, and matchmaker for regional government grants.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-sunken/60 border border-line/60">
                <span className="text-slate-500 block">In Inspection / LGU</span>
                <span className="font-extrabold text-blue-700 text-base">{inInspectionCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sunken/60 border border-line/60">
                <span className="text-slate-500 block">Prepared Filings</span>
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
              Open Registration Assistant <ArrowRight className="w-3.5 h-3.5" />
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

        {/* Module B: Local Supplier Network */}
        <div className="bg-surface border border-line rounded-2xl p-5 hover:border-brand/40 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Module B · Local Suppliers
              </span>
              <span className="text-xs text-muted flex items-center gap-1">
                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-slate-200">Sample data</span>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" /> 4.9 Trust Rating
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink mt-3">Local Suppliers Directory</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Connect with verified South Cotabato packaging suppliers, coffee roasters, equipment fabricators, and regional logistics providers.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-sunken/60 border border-line/60">
                <span className="text-slate-500 block">Sample Directory Listings</span>
                <span className="font-extrabold text-purple-900 text-base">5 Producers</span>
              </div>
              <div className="p-2.5 rounded-xl bg-sunken/60 border border-line/60">
                <span className="text-slate-500 block">Municipal Coverage</span>
                <span className="font-extrabold text-ink text-base">All 11 Municipalities</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-line flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActivePage('suppliers')}
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

      {/* Financial Health Snapshot */}
      <Panel>
        <PanelHeader
          title="Financial Health & How Long Cash Will Last"
          description={assessment ? 'Self-reported monthly overview. Helps assess grant readiness and debt capacity.' : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={handleStartCheckup}>
              <Activity className="w-3.5 h-3.5 mr-1" />
              {assessment ? 'Retake 3-Minute Checkup' : 'Start 3-Minute Checkup'}
            </Button>
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
          <div className="space-y-4">
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
              <Stat label="Monthly Sales" value={formatPesos(assessment.monthlyIncome)} />
              <Stat label="Net Monthly Profit" value={formatPesos(operatingProfit)} tone={operatingProfit >= 0 ? 'good' : 'danger'} />
              <Stat label="How Long Cash Will Last" value={cashRunway} tone="brand" />
              <Stat label="Total Business Loans" value={formatPesos(assessment.debtOutstanding)} />
            </dl>
            <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-muted">
              <span>Opening balance: ₱{(assessment.cashOnHand - operatingProfit).toLocaleString('en-PH')} · Net flow: ₱{operatingProfit.toLocaleString('en-PH')}</span>
              <button
                type="button"
                onClick={() => setActivePage('finance')}
                className="text-brand font-semibold hover:underline inline-flex items-center gap-1"
              >
                Go to Finance ledger <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-sunken px-5 py-5">
            <div>
              <p className="font-semibold text-ink">Take the 3-minute Financial Checkup</p>
              <p className="mt-1 text-sm text-muted max-w-md">
                Answer 3 simple questions about your monthly sales, expenses, and cash savings to calculate your financial health score and runway.
              </p>
            </div>
            <Button onClick={handleStartCheckup}>Start Finance Checkup</Button>
          </div>
        )}
      </Panel>

      {/* Statutory Milestones */}
      <Panel>
        <PanelHeader
          title="Statutory Business Registration Milestones"
          description="Standard sequence for MSMEs in South Cotabato under RA 11032 Ease of Doing Business."
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
                <p className="mt-2 text-xs font-medium text-muted">Visit your local municipal barangay hall</p>
              )}
            </li>
          ))}
        </ol>
      </Panel>

      {/* 3-Minute Financial Checkup Wizard Modal */}
      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="3-Minute MSME Financial Checkup"
        size="md"
      >
        <div className="space-y-5">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between border-b border-line pb-3">
            <span className="text-xs font-semibold text-muted">
              Step {wizardStep} of 4: {wizardStep === 1 ? 'Monthly Sales' : wizardStep === 2 ? 'Costs & Loans' : wizardStep === 3 ? 'Cash Reserves' : 'Your Results'}
            </span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className={cx(
                    'w-6 h-1.5 rounded-full transition-colors',
                    s === wizardStep ? 'bg-brand' : s < wizardStep ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Wizard Step 1: Monthly Sales */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-ink">What is your average monthly sales (turnover)?</h4>
                <p className="text-xs text-muted mt-1">
                  Total revenue collected from customers per month before paying costs.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Monthly Sales (₱)</label>
                <input
                  type="text"
                  value={salesInput}
                  onChange={(e) => setSalesInput(e.target.value)}
                  placeholder="e.g. 180,000"
                  className={cx(inputClass, 'text-lg font-semibold')}
                />
              </div>
              <div className="flex justify-end pt-3">
                <Button onClick={() => setWizardStep(2)}>
                  Next: Costs & Loans <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Wizard Step 2: Costs & Debt */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-ink">What are your monthly business expenses?</h4>
                <p className="text-xs text-muted mt-1">
                  Include raw materials, rent, staff wages, utilities, and packaging.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Monthly Operating Expenses (₱)</label>
                  <input
                    type="text"
                    value={expensesInput}
                    onChange={(e) => setExpensesInput(e.target.value)}
                    placeholder="e.g. 110,000"
                    className={cx(inputClass, 'font-semibold')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Monthly Loan / Amortization Payments (₱)</label>
                  <input
                    type="text"
                    value={debtInput}
                    onChange={(e) => setDebtInput(e.target.value)}
                    placeholder="e.g. 15,000 (0 if none)"
                    className={cx(inputClass, 'font-semibold')}
                  />
                  <p className="text-[11px] text-muted mt-1">Leave 0 if your business has no outstanding debts.</p>
                </div>
              </div>
              <div className="flex justify-between pt-3">
                <Button variant="ghost" onClick={() => setWizardStep(1)}>Back</Button>
                <Button onClick={() => setWizardStep(3)}>
                  Next: Cash Reserves <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Wizard Step 3: Cash Reserves */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-ink">How much liquid cash do you have right now?</h4>
                <p className="text-xs text-muted mt-1">
                  Cash on hand in your cash register, bank savings, and GCash/Maya business accounts.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Total Available Cash (₱)</label>
                <input
                  type="text"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  placeholder="e.g. 150,000"
                  className={cx(inputClass, 'text-lg font-semibold')}
                />
              </div>
              <div className="flex justify-between pt-3">
                <Button variant="ghost" onClick={() => setWizardStep(2)}>Back</Button>
                <Button variant="accent" onClick={handleComputeCheckup}>
                  Compute Health Score
                </Button>
              </div>
            </div>
          )}

          {/* Wizard Step 4: Results */}
          {wizardStep === 4 && wizardResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sunken/80 border border-line text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">Business Health Score</span>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="text-4xl font-extrabold text-ink">{wizardResult.healthScore}</span>
                  <span className="text-lg font-bold text-muted">/ 100</span>
                </div>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Status: {wizardResult.status}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-line bg-surface">
                  <span className="text-muted block">Estimated Cash Runway</span>
                  <span className="text-base font-bold text-brand mt-0.5 block">{wizardResult.runwayMonths} months</span>
                  <span className="text-[11px] text-muted">How long savings last with current outflow</span>
                </div>
                <div className="p-3 rounded-lg border border-line bg-surface">
                  <span className="text-muted block">Net Monthly Cash Flow</span>
                  <span className={cx('text-base font-bold mt-0.5 block', wizardResult.monthlyNetCash >= 0 ? 'text-emerald-700' : 'text-danger')}>
                    {formatPesos(wizardResult.monthlyNetCash)}
                  </span>
                  <span className="text-[11px] text-muted">Sales minus expenses & loans</span>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">Recommended 3 Next Steps</h5>
                <ol className="space-y-2">
                  {wizardResult.actionItems.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-ink bg-surface p-2.5 rounded-lg border border-line">
                      <span className="w-5 h-5 rounded-full bg-brand/10 text-brand font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3 border-t border-line">
                <Button variant="ghost" onClick={() => setWizardStep(1)}>
                  Recalculate
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => { setWizardOpen(false); setActivePage('finance'); }}>
                    Open Finance Tabs
                  </Button>
                  <Button onClick={handleSaveAssessment} disabled={savingAssessment}>
                    {savingAssessment ? 'Saving...' : 'Save to Dashboard'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
