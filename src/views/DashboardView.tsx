import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, fetchTickets, EfilingTicket } from '../services/apiClient';
import { ActivePage } from '../components/AppShell';
import { PhotoImg } from '../components/PhotoImg';
import { Button, Panel, PanelHeader, Modal, Notice, Field, CheckField, cx, formatPesos, inputClass } from '../components/ui';
import { PHOTOS } from '../photos';
import { calculateFinancialHealth } from '../utils/msmeLogic';
import { ArrowRight, ArrowUpRight, FileText, Store, FileCheck2, Coins, MapPin, CheckCircle2, Circle, TrendingUp, Wallet, Clock3, Sprout, RefreshCw, ChevronRight } from 'lucide-react';

type Assessment = { monthlyIncome: number; monthlyExpenses: number; cashOnHand: number; debtOutstanding: number; monthlyDebtPayment: number; otherAssets: number; otherLiabilities: number; taxStanding: string; updatedAt: string };
const EMPTY = { monthlyIncome: '', monthlyExpenses: '', cashOnHand: '', debtOutstanding: '0', monthlyDebtPayment: '0', otherAssets: '0', otherLiabilities: '0', taxStanding: '' };
const MONEY_FIELDS = [
  ['monthlyIncome', 'Monthly sales', 'Total sales before expenses.'],
  ['monthlyExpenses', 'Monthly operating expenses', 'Exclude the loan payments entered separately.'],
  ['cashOnHand', 'Cash available now', 'Cash and accessible business bank balances.'],
  ['monthlyDebtPayment', 'Monthly loan payments', 'Enter 0 if there are no loan payments.'],
  ['debtOutstanding', 'Total outstanding loans', 'The remaining amount owed, not the monthly payment.'],
  ['otherAssets', 'Other business assets', 'Your estimate of stock, equipment, and other assets.'],
  ['otherLiabilities', 'Other liabilities', 'Amounts owed that are not included in loans.']
] as const;
const TOOLS = [
  { page: 'suppliers' as ActivePage, icon: Store, title: 'Find your next local partner', detail: 'Discover packaging, materials, and services closer to home.', color: 'bg-accent-soft text-accent-ink', label: 'Supplier network' },
  { page: 'documents' as ActivePage, icon: FileText, title: 'Put your next idea on paper', detail: 'Turn your business details into a useful, editable draft.', color: 'bg-brand-soft text-brand', label: 'Document studio' },
  { page: 'marketing' as ActivePage, icon: TrendingUp, title: 'Reach the right customers', detail: 'Shape your offer and prepare your next campaign.', color: 'bg-good-soft text-good', label: 'Marketing workspace' }
];

export const DashboardView: React.FC<{ setActivePage: (page: ActivePage) => void }> = ({ setActivePage }) => {
  const { user, isDemo } = useAuth();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [tickets, setTickets] = useState<EfilingTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError('');
    const load = async () => {
      const results = await Promise.allSettled([
        apiFetch('/api/finance/assessment').then(async response => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Your financial checkup could not load.');
          return data.assessment as Assessment | null;
        }), fetchTickets()
      ]);
      if (!active) return;
      if (results[0].status === 'fulfilled') setAssessment(results[0].value);
      if (results[1].status === 'fulfilled') setTickets(results[1].value);
      if (results.some(result => result.status === 'rejected')) setLoadError('Some saved information could not load. Please retry before making changes.');
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user?.email, isDemo, reload]);
  const openCheckup = () => {
    const initial = { ...EMPTY };
    if (assessment) Object.keys(initial).forEach(key => { initial[key as keyof typeof initial] = String(assessment[key as keyof Assessment] ?? ''); });
    setForm(initial); setConsent(false); setSaveError(''); setSaved(false); setWizardOpen(true);
  };
  const saveCheckup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !consent) return;
    setSaving(true); setSaveError('');
    try {
      const amounts = Object.fromEntries(MONEY_FIELDS.map(([key]) => [key, Number(form[key])]));
      if (Object.values(amounts).some(value => !Number.isInteger(value) || value < 0 || value > 1_000_000_000)) throw new Error('Use whole peso amounts between 0 and 1 billion.');
      const response = await apiFetch('/api/finance/assessment', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...amounts, taxStanding: form.taxStanding, consent: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your checkup could not be saved. Please try again.');
      setAssessment(data.assessment || { ...amounts, taxStanding: form.taxStanding, updatedAt: new Date().toISOString() });
      setWizardOpen(false); setSaved(true);
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Saving failed. Your entries are still here.'); }
    finally { setSaving(false); }
  };
  const profit = assessment ? assessment.monthlyIncome - assessment.monthlyExpenses : 0;
  const outflows = assessment ? assessment.monthlyExpenses + assessment.monthlyDebtPayment : 0;
  const health = assessment ? calculateFinancialHealth(assessment.monthlyIncome, assessment.monthlyExpenses, assessment.monthlyDebtPayment, assessment.cashOnHand) : null;
  const stats = [
    { label: 'Monthly sales', value: assessment ? formatPesos(assessment.monthlyIncome) : '—', note: 'From your latest checkup', icon: Coins, color: 'text-brand bg-brand-soft' },
    { label: 'Operating profit', value: assessment ? formatPesos(profit) : '—', note: 'Sales less operating expenses', icon: TrendingUp, color: profit < 0 ? 'text-danger bg-danger-soft' : 'text-good bg-good-soft' },
    { label: 'Available cash', value: assessment ? formatPesos(assessment.cashOnHand) : '—', note: 'Your reported cash balance', icon: Wallet, color: 'text-accent-ink bg-accent-soft' },
    { label: 'Cash runway', value: assessment && outflows > 0 ? `${(assessment.cashOnHand / outflows).toFixed(1)} months` : '—', note: 'Cash divided by monthly outflows', icon: Clock3, color: 'text-brand bg-brand-soft' }
  ];
  const steps = [
    { title: 'Get a clear picture of your finances', description: assessment ? 'Your financial checkup is saved. Keep it current as your business changes.' : 'Add your sales, expenses, and cash to build your first snapshot.', complete: Boolean(assessment), action: openCheckup },
    { title: 'Organize your registration requirements', description: tickets.length ? `${tickets.length} preparation record${tickets.length === 1 ? '' : 's'} in your workspace.` : 'Prepare your business information and check the official portals.', complete: tickets.length > 0, action: () => setActivePage('efiling') },
    { title: 'Make a plan for what comes next', description: 'Start a business plan, feasibility study, or funding proposal.', complete: false, action: () => setActivePage('documents') }
  ];

  return <div className="space-y-7 sm:space-y-8">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="section-label mb-2">A little progress, every day</p><h1 className="text-[1.8rem] sm:text-[2.1rem] font-extrabold tracking-tight text-ink">Mabuhay{user?.firstName ? `, ${user.firstName}` : ''}<span className="text-accent">.</span></h1><p className="mt-1 text-sm text-muted">Let’s make your next business move a little clearer.</p></div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-3 py-1.5 text-[11px] text-muted"><MapPin className="w-3.5 h-3.5 text-brand" />{user?.municipality || 'South Cotabato'}</span>
    </header>
    {loadError && <Notice tone="error"><span>{loadError}</span><button type="button" onClick={() => setReload(value => value + 1)} className="ml-2 underline font-bold">Retry</button></Notice>}
    {saved && <Notice tone="success">Your checkup is saved{isDemo ? ' in this browser' : ' to your account'}. Your snapshot is up to date.</Notice>}
    <section className="dashboard-hero relative overflow-hidden rounded-[22px] text-white grid lg:grid-cols-[1.25fr_1fr]">
      <div className="hero-orbit -left-24 -top-32" />
      <div className="p-6 sm:p-8 xl:p-10 relative z-10">
        <p className="text-[10px] uppercase tracking-[.18em] font-bold text-[#E8C79F] flex items-center gap-2"><Sprout className="w-4 h-4" />Your business, growing forward</p>
        <h2 className="mt-4 text-3xl sm:text-[2.4rem] font-extrabold leading-[1.13] tracking-tight max-w-[16ch]">Small steps.<br /><span className="text-[#FFBF8C]">Stronger business.</span></h2>
        <p className="mt-4 max-w-md text-[13px] sm:text-sm leading-relaxed text-white/70">From understanding your cash flow to finding your next local partner. Your tools are here. Let’s get started.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3"><Button variant="accent" onClick={openCheckup}>{assessment ? 'Update financial checkup' : 'Start your financial checkup'}<ArrowRight /></Button><button type="button" onClick={() => setActivePage('efiling')} className="text-xs text-white/85 hover:text-white inline-flex items-center gap-1 py-2">Prepare registration<ArrowUpRight className="w-3.5 h-3.5" /></button></div>
      </div>
      <div className="hidden lg:block relative min-h-[310px]"><PhotoImg photo={PHOTOS.planting} fill eager sizes="40vw" /><div className="absolute inset-0 bg-gradient-to-r from-[#30203F] via-[#30203F]/10 to-transparent" /><div className="absolute left-7 bottom-7 right-7 rounded-xl border border-white/20 bg-night/35 backdrop-blur-md p-4"><p className="text-sm font-semibold">Rooted locally. Growing together.</p><p className="text-xs text-white/70 mt-1">A workspace for South Cotabato’s entrepreneurs.</p></div></div>
    </section>
    <section aria-labelledby="snapshot-title">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3"><h2 id="snapshot-title" className="text-[15px] font-bold">Your business at a glance</h2><button type="button" onClick={() => setActivePage('finance')} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Open finance workspace<ArrowUpRight className="w-3.5 h-3.5" /></button></div>
      <dl className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 stagger-children">{stats.map(({ label, value, note, icon: Icon, color }) => <div key={label} className="surface-panel bg-surface border border-line rounded-2xl p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><dt className="text-[11px] sm:text-xs text-muted font-medium">{label}</dt><span className={cx('p-2 rounded-lg', color)}><Icon className="w-4 h-4" /></span></div>{loading ? <dd aria-label="Loading" className="skeleton h-8 mt-3 rounded w-4/5" /> : <dd className="mt-3 text-xl sm:text-[1.65rem] font-extrabold tracking-tight tnum">{value}</dd>}<p className="text-[10px] sm:text-[11px] text-muted mt-2">{note}</p></div>)}</dl>
    </section>
    <div className="grid xl:grid-cols-[1.55fr_1fr] gap-5">
      <Panel><PanelHeader title="Your next steps" description="A practical starting point. Move at your own pace." /><div className="divide-y divide-line">{steps.map((step, index) => <button key={step.title} type="button" onClick={step.action} className="group w-full flex items-start text-left gap-3.5 py-4 first:pt-0 last:pb-0"><span className={cx('w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold', step.complete ? 'bg-good-soft text-good' : 'bg-sunken text-muted')}>{step.complete ? <CheckCircle2 className="w-4 h-4" /> : `0${index + 1}`}</span><span className="flex-1"><span className="block text-[13px] font-semibold group-hover:text-brand transition-colors">{step.title}</span><span className="block mt-1 text-xs leading-relaxed text-muted">{step.description}</span></span><ChevronRight className="w-4 h-4 text-muted/50 mt-1.5 group-hover:text-brand" /></button>)}</div></Panel>
      <Panel className="!bg-[#F0E9F6] !border-[#E4D8EE] flex flex-col"><div className="flex items-center justify-between"><span className="section-label !text-brand">A sounding board for your business</span><img src="./logos/Narra.png" alt="Boss Narra" className="w-12 h-12 object-contain" /></div><h2 className="text-2xl font-extrabold tracking-tight mt-4 text-brand-deep">Big question?<br />Start a conversation.</h2><p className="text-sm text-muted leading-relaxed mt-3 mb-5">Talk through a business idea, understand your numbers, or find where to start with registration.</p><Button className="mt-auto self-start" onClick={() => setActivePage('boss-nana')}>Ask Boss Narra<ArrowRight /></Button></Panel>
    </div>
    <section aria-labelledby="toolbox-title"><div className="mb-4"><p className="section-label mb-1.5">Your everyday toolkit</p><h2 id="toolbox-title" className="text-xl font-bold tracking-tight">Good things start with the right tools.</h2></div><div className="grid sm:grid-cols-3 gap-4 stagger-children">{TOOLS.map(({ page, icon: Icon, title, detail, color, label }) => <button type="button" onClick={() => setActivePage(page)} key={page} className="interactive-card text-left bg-surface border border-line rounded-2xl p-5 flex flex-col"><span className="flex justify-between items-start"><span className={cx('w-10 h-10 flex items-center justify-center rounded-xl', color)}><Icon className="w-5 h-5" /></span><ArrowUpRight className="w-4 h-4 text-muted/50" /></span><span className="section-label mt-5 !text-[9px]">{label}</span><span className="mt-2 font-bold text-[15px] leading-snug">{title}</span><span className="text-xs text-muted leading-relaxed mt-2">{detail}</span></button>)}</div></section>
    {health && <Panel className="!bg-sunken/60"><PanelHeader title="A closer look at your cash flow" description="Planning estimates from your checkup. Update them when your circumstances change." /><div className="grid sm:grid-cols-3 gap-3">{health.actionItems.map((item, index) => <p key={item} className="text-xs text-muted leading-relaxed flex gap-2"><span className="font-bold text-brand">0{index + 1}</span>{item}</p>)}</div></Panel>}
    <Modal open={wizardOpen} onClose={() => { if (!saving) setWizardOpen(false); }} title="Your financial checkup" description="A few numbers today. A clearer view of tomorrow. Enter whole Philippine peso amounts." size="lg" dismissable={!saving}>
      <form onSubmit={saveCheckup} className="space-y-5">
        {saveError && <Notice tone="error">{saveError}</Notice>}
        <fieldset disabled={saving} className="grid sm:grid-cols-2 gap-4">{MONEY_FIELDS.map(([key, label, hint]) => <Field key={key} label={label} hint={hint}>{id => <input id={id} type="number" inputMode="numeric" min="0" max="1000000000" step="1" required value={form[key]} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} placeholder="0" className={inputClass} />}</Field>)}<Field label="Tax registration status">{id => <select id={id} required value={form.taxStanding} onChange={event => setForm(previous => ({ ...previous, taxStanding: event.target.value }))} className={inputClass}><option value="">Choose your status</option><option value="current">Registered; filings current</option><option value="needs-filing">Registered; filing needed</option><option value="behind">Registered; overdue filings</option><option value="not-registered">Not yet registered</option></select>}</Field></fieldset>
        <CheckField checked={consent} onChange={setConsent} required>I agree to save this self-reported checkup {isDemo ? 'in this browser for the demo' : 'to my account'}. I can remove my data from Privacy & your data.</CheckField>
        <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="ghost" disabled={saving} onClick={() => setWizardOpen(false)}>Cancel</Button><Button type="submit" busy={saving} busyLabel="Saving your checkup…" disabled={!consent}>Save my checkup<ArrowRight /></Button></div>
      </form>
    </Modal>
  </div>;
};
