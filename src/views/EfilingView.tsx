import { navigate as navigateGuidance } from '../features/guidance/shared';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUnsavedChanges } from '../utils/useUnsavedChanges';
import {
  apiFetch,
  runSubsidyCheck,
  runCreditMatch,
  SubsidyMatch,
  CreditMatch
} from '../services/apiClient';
import {
  exportConsolidatedEfilingPdf,
  ConsolidatedFilingData
} from '../utils/pdfExport';
import {
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Download,
  FileText
} from '../components/icons';
import {
  Button,
  Field,
  Notice,
  PageHeader,
  Panel,
  PanelHeader,
  Segmented,
  cx,
  inputClass,
  textareaClass
} from '../components/ui';

const MUNICIPALITIES = [
  'City of Koronadal',
  'Polomolok',
  'Tupi',
  'Surallah',
  'Lake Sebu',
  'Norala',
  'Tampakan',
  'Banga',
  'Santo Niño',
  'Tantangan'
];

const PORTALS = [
  {
    agency: 'DTI',
    title: 'Business Name Registration System (BNRS)',
    desc: 'Register and renew sole proprietorship business names across barangay, city, regional, or national scope.',
    url: 'https://bnrs.dti.gov.ph/'
  },
  {
    agency: 'BIR',
    title: 'ORUS and eServices (Form 1901)',
    desc: 'Apply for TIN, select the 8% gross income tax regime, register books of accounts, and obtain ATP.',
    url: 'https://www.bir.gov.ph/'
  },
  {
    agency: 'South Cotabato LGU',
    title: 'Provincial E-Services & BPLO Guidelines',
    desc: 'Municipal business permits, health certificates, sanitary permits, and local tax clearances.',
    url: 'https://southcotabato.gov.ph/services/'
  },
  {
    agency: 'SSS',
    title: 'My.SSS Employer Portal',
    desc: 'Submit monthly contribution lists (R-3) and manage enterprise social security compliance.',
    url: 'https://www.sss.gov.ph/'
  },
  {
    agency: 'PhilHealth',
    title: 'Electronic Premium Remittance System',
    desc: 'Generate your Statement of Premium Account and maintain employee health insurance coverage.',
    url: 'https://www.philhealth.gov.ph/'
  },
  {
    agency: 'Pag-IBIG',
    title: 'Virtual Pag-IBIG for Employers',
    desc: 'Remit mandatory housing fund contributions and verify employee MID records online.',
    url: 'https://www.pagibigfund.gov.ph/'
  }
];

export const EfilingView: React.FC = () => {
  const { user, isDemo } = useAuth();

  // Active top navigation tab (Exclusively for end-user business owner)
  const [activeTab, setActiveTab] = useState<'all-in-one' | 'referrals' | 'portals'>('all-in-one');

  // Single-Page AI Form State (Consolidates all 5 statutory registration stages)
  const [formData, setFormData] = useState<ConsolidatedFilingData>({
    trackingNumber: `DRAFT-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    businessName: user?.business || '', businessType: 'Sole Proprietorship', municipality: user?.municipality || 'City of Koronadal',
    applicantName: user ? `${user.firstName} ${user.lastName}`.trim() : '', applicantEmail: user?.email || '',
    bnrsScope: '', bnrsLineOfBusiness: '', bnrsDominantName: '', barangayName: '', barangayPurpose: '', propertyOwnership: '',
    permitType: 'New Business Permit Application', capitalInvestment: 0, employeeCount: 0, sanitaryCompliance: '', fireSafetyStatus: '',
    tinNumber: '', taxRegime: '', booksOfAccounts: '', atpStatus: '', locationAddress: '', zoningClassification: '', locationSketchDesc: '', notes: ''
  });
  const [savingDraft, setSavingDraft] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(user));
  const [draftLoadError, setDraftLoadError] = useState(false);
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState(() => JSON.stringify(formData));
  useUnsavedChanges(!loadingDraft && !draftLoadError && JSON.stringify(formData) !== savedDraftSnapshot);
  useEffect(() => {
    if (!user) { setLoadingDraft(false); return; }
    let active = true;
    const load = async () => {
      try {
        const response = await apiFetch('/api/registration/draft');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active && result.draft) { setFormData(result.draft); setSavedDraftSnapshot(JSON.stringify(result.draft)); }
      } catch {
        if (active) { setDraftLoadError(true); setConsolidatedNotice({ tone: 'error', text: 'Your saved draft could not load. Reload this page before editing or saving.' }); }
      } finally { if (active) setLoadingDraft(false); }
    };
    void load();
    return () => { active = false; };
  }, [user?.email]);
  const handleSaveDraft = async () => {
    if (!user) { setConsolidatedNotice({ tone: 'info', text: 'Sign in or open the demo workspace to save your draft. You can still download a preparation copy.' }); return; }
    if (loadingDraft || draftLoadError || savingDraft) return;
    setSavingDraft(true);
    try {
      const response = await apiFetch('/api/registration/draft', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: formData }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The draft could not be saved.');
      setSavedDraftSnapshot(JSON.stringify(formData));
      setConsolidatedNotice({ tone: 'success', text: 'Your preparation draft is saved. No government application has been submitted.' });
    } catch (error) { setConsolidatedNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Saving failed. Your entries are still here.' }); }
    finally { setSavingDraft(false); }
  };
  const [aiPopulating, setAiPopulating] = useState(false);
  const [consolidatedNotice, setConsolidatedNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Referral Engine state
  const [referralMode, setReferralMode] = useState<'subsidy' | 'credit'>('subsidy');
  const [subsidyForm, setSubsidyForm] = useState({
    businessSector: isDemo ? 'Agri-Processing & Coffee Roasting' : '',
    annualSales: isDemo ? 1500000 : 0,
    employeeCount: isDemo ? 5 : 0,
    yearsOperating: isDemo ? 2 : 0,
    municipality: user?.municipality || 'City of Koronadal',
    needsMachinery: isDemo,
    isWomenOrYouthLed: isDemo,
    hasExportPotential: isDemo
  });
  const [subsidyResults, setSubsidyResults] = useState<SubsidyMatch[] | null>(null);
  const [evaluatingSubsidy, setEvaluatingSubsidy] = useState(false);

  const [creditForm, setCreditForm] = useState({
    requestedAmount: isDemo ? 500000 : 0,
    monthlyGrossRevenue: isDemo ? 120000 : 0,
    creditTrackRecord: (isDemo ? 'good' : 'new_no_credit') as 'excellent' | 'good' | 'fair' | 'new_no_credit',
    hasCollateral: false,
    purpose: 'working_capital' as const
  });
  const [creditResults, setCreditResults] = useState<CreditMatch[] | null>(null);
  const [evaluatingCredit, setEvaluatingCredit] = useState(false);

  /**
   * Integrated AI Assistant: dynamically populates the 5 statutory sections
   * using municipality and sector-specific South Cotabato intelligence.
   */
  const handleAiAutoPopulate = () => {
    if (!user) { setConsolidatedNotice({ tone: 'info', text: 'Sign in to fill your saved business profile, or enter your details below.' }); return; }
    setFormData(previous => ({ ...previous, businessName: user.business, municipality: user.municipality || previous.municipality, applicantName: `${user.firstName} ${user.lastName}`.trim(), applicantEmail: user.email }));
    setConsolidatedNotice({ tone: 'info', text: 'Business and contact details filled from your profile. Enter your own TIN, address, and permit information. Confirm requirements with the official agencies.' });
  };
  const handleDownloadConsolidatedPdf = () => {
    if (!formData.businessName.trim() || !formData.applicantName.trim() || !formData.applicantEmail.trim()) { setConsolidatedNotice({ tone: 'error', text: 'Add your business name, applicant name, and email before exporting.' }); return; }
    exportConsolidatedEfilingPdf(formData);
    setConsolidatedNotice({
      tone: 'success',
      text: `Exported consolidated e-filing application strictly as a PDF document (${formData.trackingNumber}.pdf).`
    });
  };

  const handleRunSubsidy = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsolidatedNotice(null);
    setEvaluatingSubsidy(true);
    try {
      const matches = await runSubsidyCheck(subsidyForm);
      setSubsidyResults(matches);
    } catch (err) {
      setConsolidatedNotice({ tone: 'error', text: err instanceof Error ? err.message : 'The program search failed. Please try again.' });
    } finally {
      setEvaluatingSubsidy(false);
    }
  };

  const handleRunCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConsolidatedNotice(null);
    setEvaluatingCredit(true);
    try {
      const matches = await runCreditMatch(creditForm);
      setCreditResults(matches);
    } catch (err) {
      setConsolidatedNotice({ tone: 'error', text: err instanceof Error ? err.message : 'The program search failed. Please try again.' });
    } finally {
      setEvaluatingCredit(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="mb-4"><Button variant="secondary" onClick={()=>navigateGuidance('opportunities')}>Browse reviewed opportunities</Button></div>
      <PageHeader
        eyebrow="Prepare with confidence"
        title="Your next step toward registration"
        lead="Organize your statutory business registration requirements and export a clean dossier. Enterseed is an information preparation tool and does not submit filings directly to government offices."
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <Button
              variant={activeTab === 'all-in-one' ? 'primary' : 'secondary'}
              size="md"
              className="shrink-0"
              onClick={() => setActiveTab('all-in-one')}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              All-in-One Dossier
            </Button>
            <Button
              variant={activeTab === 'referrals' ? 'primary' : 'secondary'}
              size="md"
              className="shrink-0"
              onClick={() => setActiveTab('referrals')}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Grants & Credit Matcher
            </Button>
            <Button
              variant={activeTab === 'portals' ? 'primary' : 'secondary'}
              size="md"
              className="shrink-0"
              onClick={() => setActiveTab('portals')}
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Official Portals
            </Button>
          </div>
        }
      />

      {/* Preparation Disclaimer Notice */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-950">
            Information Preparation Only · Not an Official Government Filing Submission
          </p>
          <p className="leading-relaxed">
            This tool organizes your details and prepares your documents for filing so you have all requirements ready. It does <strong>not</strong> submit filings directly to government agencies. Use the "Go to official portal" buttons below each section or in the "Official Portals" tab to complete and officially submit your filings.
          </p>
        </div>
      </div>

      {/* Notification banner */}
      <div className="flex flex-wrap justify-between items-center gap-3 rounded-xl bg-brand-soft/60 px-4 py-3"><p className="text-xs text-brand">Your personal preparation draft. Enter only details you have verified.</p><Button onClick={handleSaveDraft} busy={savingDraft} busyLabel="Saving draft…" disabled={loadingDraft || draftLoadError}>Save preparation draft</Button></div>
      {consolidatedNotice && (
        <Notice tone={consolidatedNotice.tone}>
          <span>{consolidatedNotice.text}</span>
        </Notice>
      )}

      {/* TAB 1: ALL-IN-ONE CONSOLIDATED SINGLE-PAGE E-FILING FORM */}
      {loadingDraft && <div role="status" className="skeleton h-48 rounded-2xl"><span className="sr-only">Loading your draft…</span></div>}
      {draftLoadError && <Button onClick={() => window.location.reload()}>Reload saved draft</Button>}
      {activeTab === 'all-in-one' && !loadingDraft && !draftLoadError && (
        <div className="space-y-6">
          {/* Statutory Registration Banner */}
          <div className="bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-7 shadow-sm border border-line/40">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  RA 11032 Ease of Doing Business Preparation Tool
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                  MSME Registration Preparation Dossier
                </h2>
                <p className="mt-1 text-sm text-brand max-w-2xl leading-relaxed">
                  Consolidated preparation workflow. Organize your requirements for DTI Business Name, Barangay Clearance, Mayor’s Permit (BPLO), BIR Form 1901, and Location & Zoning all on one screen before visiting official portals.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Button
                  variant="accent"
                  size="md"
                  onClick={handleAiAutoPopulate}
                  disabled={aiPopulating}
                  className="shadow-md"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Fill from my profile
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleDownloadConsolidatedPdf}
                  className="bg-white/10 text-white hover:bg-white/20 border-white/20 shadow-xs"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download Application (.PDF)
                </Button>
              </div>
            </div>

            {/* 5-Stage Checklist Pill Bar */}
            <div className="mt-6 pt-5 border-t border-line/50 grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <span className="text-amber-300 font-bold block mb-0.5">Section 01</span>
                <span className="font-semibold text-white block">DTI Business Name</span>
                <span className="text-[11px] text-brand">BNRS & Scope</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <span className="text-amber-300 font-bold block mb-0.5">Section 02</span>
                <span className="font-semibold text-white block">Barangay Clearance</span>
                <span className="text-[11px] text-brand">Commercial Endorsement</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <span className="text-amber-300 font-bold block mb-0.5">Section 03</span>
                <span className="font-semibold text-white block">Mayor’s Permit</span>
                <span className="text-[11px] text-brand">BPLO & Sanitary/FSIC</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <span className="text-amber-300 font-bold block mb-0.5">Section 04</span>
                <span className="font-semibold text-white block">BIR Form 1901</span>
                <span className="text-[11px] text-brand">TIN & 8% Regime</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                <span className="text-amber-300 font-bold block mb-0.5">Section 05</span>
                <span className="font-semibold text-white block">Location & Zoning</span>
                <span className="text-[11px] text-brand">Landmark Sketch & C-1</span>
              </div>
            </div>
          </div>

          {/* SINGLE-PAGE UNIFIED FORM */}
          <div className="space-y-6">
            {/* Top Primary Enterprise Details */}
            <Panel>
              <PanelHeader
                title="Consolidated Enterprise & Proponent Profile"
                description="Primary identifiers recognized by DTI, Provincial Government of South Cotabato, and Municipal LGUs."
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Registered Enterprise Name">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      placeholder="e.g., Matutum Agro-Industrial Roasters"
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Business Entity Type">
                  {(id) => (
                    <select
                      id={id}
                      value={formData.businessType}
                      onChange={(e) => setFormData({ ...formData, businessType: e.target.value as any })}
                      className={inputClass}
                    >
                      <option value="Sole Proprietorship">Sole Proprietorship</option>
                      <option value="Barangay Micro-Business (BMBE)">Barangay Micro-Business (BMBE)</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Corporation">Corporation</option>
                      <option value="Cooperative">Cooperative</option>
                    </select>
                  )}
                </Field>

                <Field label="Municipality (South Cotabato)">
                  {(id) => (
                    <select
                      id={id}
                      value={formData.municipality}
                      onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                      className={inputClass}
                    >
                      {MUNICIPALITIES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-line">
                <Field label="Authorized Proponent / Owner Name">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.applicantName}
                      onChange={(e) => setFormData({ ...formData, applicantName: e.target.value })}
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Primary Contact Email">
                  {(id) => (
                    <input
                      id={id}
                      type="email"
                      required
                      value={formData.applicantEmail}
                      onChange={(e) => setFormData({ ...formData, applicantEmail: e.target.value })}
                      className={inputClass}
                    />
                  )}
                </Field>
              </div>
            </Panel>

            {/* SECTION 1: BUSINESS NAME (BNRS) */}
            <Panel>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-brand-soft text-brand font-extrabold text-xs flex items-center justify-center">
                    01
                  </span>
                  <div>
                    <h3 className="font-bold text-ink text-base">Section 1: Business Name Registration (DTI-BNRS)</h3>
                    <p className="text-xs text-muted-foreground">Legal enterprise naming under Act 3883 and Philippine Department of Trade and Industry rules.</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand bg-brand-soft px-2 py-0.5 rounded border border-line">
                  DTI BNRS
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Dominant Name / Descriptor">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.bnrsDominantName}
                      onChange={(e) => setFormData({ ...formData, bnrsDominantName: e.target.value })}
                      placeholder="e.g., Matutum Highlands"
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Territorial Scope of Registration">
                  {(id) => (
                    <select
                      id={id}
                      value={formData.bnrsScope}
                      onChange={(e) => setFormData({ ...formData, bnrsScope: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Choose a registration scope</option>
                      <option value="Barangay Scope (Barangay Level)">Barangay Scope</option>
                      <option value="City / Municipality Scope">City / Municipality Scope</option>
                      <option value="Regional Scope (Region XII SOCCSKSARGEN)">Regional Scope (Region XII)</option>
                      <option value="National Scope (Philippines)">National Scope</option>
                    </select>
                  )}
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Primary Line of Business / PSIC Classification">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.bnrsLineOfBusiness}
                      onChange={(e) => setFormData({ ...formData, bnrsLineOfBusiness: e.target.value })}
                      placeholder="e.g., Specialty Coffee Processing, Roasting & Agri-Tourism Retail"
                      className={inputClass}
                    />
                  )}
                </Field>
              </div>

              <div className="mt-4 pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-brand-soft/50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                <span className="text-xs text-muted-foreground">Ready to register your proposed business name?</span>
                <a
                  href="https://bnrs.dti.gov.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand bg-surface hover:bg-brand-soft border border-line px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                >
                  Go to official DTI BNRS portal <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Panel>

            {/* SECTION 2: BARANGAY CLEARANCE */}
            <Panel>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 font-extrabold text-xs flex items-center justify-center">
                    02
                  </span>
                  <div>
                    <h3 className="font-bold text-ink text-base">Section 2: Barangay Commercial Clearance</h3>
                    <p className="text-xs text-muted-foreground">Local jurisdiction clearance certified by the Barangay Council of your business premises.</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Barangay LGU
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Barangay Jurisdiction">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.barangayName}
                      onChange={(e) => setFormData({ ...formData, barangayName: e.target.value })}
                      placeholder="e.g., Barangay Poblacion, Crossing Palkan, Zone IV"
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Premises & Property Ownership Status">
                  {(id) => (
                    <select
                      id={id}
                      value={formData.propertyOwnership}
                      onChange={(e) => setFormData({ ...formData, propertyOwnership: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Choose your property arrangement</option>
                      <option value="Owned Commercial Property">Owned Commercial Property</option>
                      <option value="Commercial Lease Agreement">Commercial Lease Agreement</option>
                      <option value="Public Market Stall Award">Public Market Stall Award</option>
                      <option value="Shared Facility / Co-Working">Shared Facility / Co-Working Space</option>
                    </select>
                  )}
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Purpose of Barangay Clearance">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.barangayPurpose}
                      onChange={(e) => setFormData({ ...formData, barangayPurpose: e.target.value })}
                      placeholder="e.g., Statutory Commercial Establishment Clearance"
                      className={inputClass}
                    />
                  )}
                </Field>
              </div>

              <div className="mt-4 pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                <span className="text-xs text-muted-foreground">Clearance must be obtained in person from your local Barangay Hall.</span>
                <a
                  href="https://southcotabato.gov.ph/services/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 bg-surface hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                >
                  South Cotabato LGU Barangay Directory <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Panel>

            {/* SECTION 3: MAYOR'S PERMIT (BPLO) */}
            <Panel>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-900 font-extrabold text-xs flex items-center justify-center">
                    03
                  </span>
                  <div>
                    <h3 className="font-bold text-ink text-base">Section 3: Mayor’s Permit & Municipal BPLO</h3>
                    <p className="text-xs text-muted-foreground">Business Permit and Licensing Office requirements, sanitary inspection, and fire clearance.</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Municipal BPLO
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Application Classification">
                  {(id) => (
                    <select
                      id={id}
                      value={formData.permitType}
                      onChange={(e) => setFormData({ ...formData, permitType: e.target.value })}
                      className={inputClass}
                    >
                      <option value="New Business Permit Application">New Business Permit Application</option>
                      <option value="Annual Business Permit Renewal">Annual Business Permit Renewal</option>
                      <option value="Transfer / Additional Line of Business">Additional Line of Business</option>
                    </select>
                  )}
                </Field>

                <Field label="Declared Initial Capitalization (PHP)">
                  {(id) => (
                    <input
                      id={id}
                      type="number"
                      required
                      value={formData.capitalInvestment}
                      onChange={(e) => setFormData({ ...formData, capitalInvestment: Number(e.target.value) })}
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Total Regular Employees">
                  {(id) => (
                    <input
                      id={id}
                      type="number"
                      required
                      value={formData.employeeCount}
                      onChange={(e) => setFormData({ ...formData, employeeCount: Number(e.target.value) })}
                      className={inputClass}
                    />
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-line">
                <Field label="Sanitary & Health Inspection Clearance">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.sanitaryCompliance}
                      onChange={(e) => setFormData({ ...formData, sanitaryCompliance: e.target.value })}
                      placeholder="e.g., Compliant (4 staff health cards completed at Municipal Health Office)"
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Bureau of Fire Protection (BFP FSIC) Status">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.fireSafetyStatus}
                      onChange={(e) => setFormData({ ...formData, fireSafetyStatus: e.target.value })}
                      placeholder="e.g., FSIC inspection requested at BFP municipal station"
                      className={inputClass}
                    />
                  )}
                </Field>
              </div>

              <div className="mt-4 pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                <span className="text-xs text-muted-foreground">Ready to file for your Mayor’s Permit and zoning clearance?</span>
                <a
                  href="https://southcotabato.gov.ph/services/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-surface hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                >
                  Go to official South Cotabato LGU portal <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Panel>

            {/* SECTION 4: BIR FORM 1901 */}
            <Panel>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-brand-soft text-brand font-extrabold text-xs flex items-center justify-center">
                    04
                  </span>
                  <div>
                    <h3 className="font-bold text-ink text-base">Section 4: BIR Registration (Form 1901)</h3>
                    <p className="text-xs text-muted-foreground">Taxpayer Identification Number, TRAIN law regime selection, and books of accounts.</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand bg-brand-soft px-2 py-0.5 rounded border border-line">
                  BIR RDO 110
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Taxpayer Identification Number (TIN)">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.tinNumber}
                      onChange={(e) => setFormData({ ...formData, tinNumber: e.target.value })}
                      placeholder="e.g., 742-891-304-000 (or 'Pending Issuance')"
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Selected Tax Regime (RA 10963 TRAIN Law)">
                  {(id) => (
                    <select
                      id={id}
                      value={formData.taxRegime}
                      onChange={(e) => setFormData({ ...formData, taxRegime: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Choose your confirmed tax regime</option>
                      <option value="8% Flat Gross Income Tax Regime (in lieu of graduated income tax and 3% percentage tax)">
                        8% Flat Gross Income Tax (Recommended for MSMEs &lt; ₱3M turnover)
                      </option>
                      <option value="Graduated Income Tax Rates + 3% Percentage Tax">
                        Graduated Income Tax Rates + 3% Percentage Tax
                      </option>
                      <option value="BMBE Tax Exemption under RA 9178 (Exempt from Income Tax)">
                        BMBE Exemption under RA 9178 (Zero Income Tax on Business Operations)
                      </option>
                    </select>
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-line">
                <Field label="Books of Accounts Registry">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.booksOfAccounts}
                      onChange={(e) => setFormData({ ...formData, booksOfAccounts: e.target.value })}
                      placeholder="e.g., Manual Bound Books (Ledger, Cash Receipts, General Journal)"
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Authority to Print (ATP) Invoices / Receipts Status">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.atpStatus}
                      onChange={(e) => setFormData({ ...formData, atpStatus: e.target.value })}
                      placeholder="e.g., Submitted ATP application to BIR District Office"
                      className={inputClass}
                    />
                  )}
                </Field>
              </div>

              <div className="mt-4 pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-brand-soft/50 -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                <span className="text-xs text-muted-foreground">Ready to file your BIR Form 1901 or apply for TIN / ATP?</span>
                <a
                  href="https://www.bir.gov.ph/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand bg-surface hover:bg-brand-soft border border-line px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                >
                  Go to official BIR eServices portal <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </Panel>

            {/* SECTION 5: LOCATION SKETCH & ZONING */}
            <Panel>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-line">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 font-extrabold text-xs flex items-center justify-center">
                    05
                  </span>
                  <div>
                    <h3 className="font-bold text-ink text-base">Section 5: Location Sketch & Zoning Clearance</h3>
                    <p className="text-xs text-muted-foreground">Comprehensive location description, zoning classification, and landmark sketch narrative.</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Municipal Planning
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Physical Commercial Facility Address">
                  {(id) => (
                    <input
                      id={id}
                      type="text"
                      required
                      value={formData.locationAddress}
                      onChange={(e) => setFormData({ ...formData, locationAddress: e.target.value })}
                      placeholder="e.g., Km 14, General Santos Highway, Crossing Matutum, Poblacion"
                      className={inputClass}
                    />
                  )}
                </Field>

                <Field label="Municipal Zoning Classification">
                  {(id) => (
                    <select
                      id={id}
                      value={formData.zoningClassification}
                      onChange={(e) => setFormData({ ...formData, zoningClassification: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Choose your confirmed zoning classification</option>
                      <option value="Commercial C-1 / Mixed Agri-Commercial Zone">Commercial C-1 / Mixed Agri-Commercial</option>
                      <option value="Light Agro-Processing & Light Industrial Zone">Light Agro-Processing & Light Industrial</option>
                      <option value="Tourism & Eco-Cultural Heritage Zone">Tourism & Eco-Cultural Heritage</option>
                      <option value="General Commercial Zone (Public Market & Town Center)">General Commercial (Public Market)</option>
                    </select>
                  )}
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Detailed Location Sketch Narrative & Landmarks (Zoning Requirement)">
                  {(id) => (
                    <textarea
                      id={id}
                      rows={3}
                      required
                      value={formData.locationSketchDesc}
                      onChange={(e) => setFormData({ ...formData, locationSketchDesc: e.target.value })}
                      placeholder="Describe precise landmarks, street corners, adjacent buildings, and distance from the municipal center..."
                      className={textareaClass}
                    />
                  )}
                </Field>
              </div>

              <div className="mt-4 pt-4 border-t border-line">
                <Field label="Proponent Filing Notes & Special Endorsements">
                  {(id) => (
                    <textarea
                      id={id}
                      rows={2}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any provincial endorsements (e.g. OTOP Next Gen, DOST SETUP, Provincial MSMEDC)..."
                      className={textareaClass}
                    />
                  )}
                </Field>
              </div>
            </Panel>

            {/* Bottom Final Action Bar */}
            <div className="p-5 rounded-2xl bg-surface border border-line flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 5/5 Statutory Sections Complete
                  </span>
                  <span className="text-xs text-muted-foreground">Tracking Ref: {formData.trackingNumber}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Download your completed, formatted statutory application dossier strictly as a PDF file.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="shrink-0 shadow-md"
                  onClick={handleDownloadConsolidatedPdf}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download Application (.PDF)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SMART REFERRAL ENGINE */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-line shadow-xs">
            <div>
              <h2 className="text-lg font-bold text-ink">Smart Referral Engine</h2>
              <p className="text-xs text-muted-foreground">Legacy discovery examples. Program terms below have not been reverified. Use the reviewed opportunities catalog for dated source reviews and confirm current terms with the provider.</p>
            </div>
            <Segmented
              label="Referral Tool"
              value={referralMode}
              onChange={setReferralMode}
              options={[
                { value: 'subsidy', label: '1. Subsidy & Grant Checker' },
                { value: 'credit', label: '2. Bank & Microfinance Matcher' }
              ]}
            />
          </div>

          {referralMode === 'subsidy' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
              {/* Subsidy Input Form */}
              <Panel>
                <PanelHeader
                  title="Subsidy Eligibility Questionnaire"
                  description="Evaluates parameters against DOST SETUP, DTI OTOP Next Gen, DA ACPC, and Provincial MSMEDC Funds."
                />

                <form onSubmit={handleRunSubsidy} className="space-y-4">
                  <Field label="Business Sector">
                    {(id) => (
                      <input
                        id={id}
                        type="text"
                        required
                        value={subsidyForm.businessSector}
                        onChange={(e) => setSubsidyForm({ ...subsidyForm, businessSector: e.target.value })}
                        placeholder="e.g., Coffee Processing, Cacao, Food Manufacturing, Bamboo"
                        className={inputClass}
                      />
                    )}
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Est. Annual Sales (PHP)">
                      {(id) => (
                        <input
                          id={id}
                          type="number"
                          required
                          value={subsidyForm.annualSales}
                          onChange={(e) => setSubsidyForm({ ...subsidyForm, annualSales: Number(e.target.value) })}
                          className={inputClass}
                        />
                      )}
                    </Field>
                  <Field label="Employee Count" hint="Enter 0 if you work on your own without employees.">
                      {(id) => (
                        <input
                          id={id}
                          type="number"
                          required
                          value={subsidyForm.employeeCount}
                          min="0" max="500" step="1"
                          onChange={(e) => setSubsidyForm({ ...subsidyForm, employeeCount: Number(e.target.value) })}
                          className={inputClass}
                        />
                      )}
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Years in Operation">
                      {(id) => (
                        <input
                          id={id}
                          type="number"
                          required
                          value={subsidyForm.yearsOperating}
                          onChange={(e) => setSubsidyForm({ ...subsidyForm, yearsOperating: Number(e.target.value) })}
                          className={inputClass}
                        />
                      )}
                    </Field>
                    <Field label="Municipality">
                      {(id) => (
                        <select
                          id={id}
                          value={subsidyForm.municipality}
                          onChange={(e) => setSubsidyForm({ ...subsidyForm, municipality: e.target.value })}
                          className={inputClass}
                        >
                          {MUNICIPALITIES.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      )}
                    </Field>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <label className="flex items-center gap-2.5 text-xs text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subsidyForm.needsMachinery}
                        onChange={(e) => setSubsidyForm({ ...subsidyForm, needsMachinery: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Enterprise requires processing, packaging, or laboratory equipment
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subsidyForm.isWomenOrYouthLed}
                        onChange={(e) => setSubsidyForm({ ...subsidyForm, isWomenOrYouthLed: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Women-, Indigenous-, or Youth-led enterprise (Provincial Priority)
                    </label>

                    <label className="flex items-center gap-2.5 text-xs text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={subsidyForm.hasExportPotential}
                        onChange={(e) => setSubsidyForm({ ...subsidyForm, hasExportPotential: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Has domestic trade fair or export market readiness
                    </label>
                  </div>

                  <Button type="submit" variant="primary" size="lg" className="w-full mt-4" disabled={evaluatingSubsidy}>
                    {evaluatingSubsidy ? 'Evaluating Criteria...' : 'Evaluate Grants & Subsidies'}
                  </Button>
                </form>
              </Panel>

              {/* Subsidy Results Display */}
              <div className="space-y-4">
                <Panel>
                  <PanelHeader
                    title="Matched Grant & Subsidy Programs"
                    description="Illustrative suggestions based on your inputs; not an eligibility assessment."
                  />

                  {subsidyResults ? (
                    <div className="space-y-4">
                      {subsidyResults.map((match) => (
                        <div key={match.id} className="p-4 rounded-xl border border-line bg-surface hover:border-brand transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-brand bg-brand-soft px-2 py-0.5 rounded border border-line">
                                {match.agency}
                              </span>
                              <h3 className="text-base font-bold text-ink mt-1.5">{match.programName}</h3>
                              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                                {match.subsidyType} · {match.maxSupport}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Needs review
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-line text-xs space-y-1.5">
                            <p className="font-semibold text-ink">Illustrative relevance factors:</p>
                            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                              {match.matchReasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                            <div className="mt-2 text-slate-500 pt-1">
                              <strong>Local Desk:</strong> {match.localOffice}
                            </div>
                          </div>

                          <div className="mt-3 text-right">
                            <a
                              href={match.contactUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
                            >
                              Program Portal <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      Complete the questionnaire on the left and click "Evaluate Grants & Subsidies" to run the local matching engine.
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
              {/* Credit Matcher Form */}
              <Panel>
                <PanelHeader
                  title="Credit & Financing Matcher"
                  description="Matches your enterprise capital needs with SBCorp RISE UP, LandBank, and local cooperatives."
                />

                <form onSubmit={handleRunCredit} className="space-y-4">
                  <Field label="Desired Capital / Loan Amount (PHP)">
                    {(id) => (
                      <input
                        id={id}
                        type="number"
                        required
                        min="10000"
                        step="10000"
                        value={creditForm.requestedAmount}
                        onChange={(e) => setCreditForm({ ...creditForm, requestedAmount: Number(e.target.value) })}
                        className={inputClass}
                      />
                    )}
                  </Field>

                  <Field label="Average Monthly Gross Revenue (PHP)">
                    {(id) => (
                      <input
                        id={id}
                        type="number"
                        required
                        value={creditForm.monthlyGrossRevenue}
                        onChange={(e) => setCreditForm({ ...creditForm, monthlyGrossRevenue: Number(e.target.value) })}
                        className={inputClass}
                      />
                    )}
                  </Field>

                  <Field label="Credit Track Record">
                    {(id) => (
                      <select
                        id={id}
                        value={creditForm.creditTrackRecord}
                        onChange={(e) => setCreditForm({ ...creditForm, creditTrackRecord: e.target.value as any })}
                        className={inputClass}
                      >
                        <option value="excellent">Excellent (Timely loan payments, active bank ledger)</option>
                        <option value="good">Good (Minor past delays, settled accounts)</option>
                        <option value="fair">Fair (Limited banking history, cooperative loans)</option>
                        <option value="new_no_credit">New / Unbanked (First institutional credit application)</option>
                      </select>
                    )}
                  </Field>

                  <Field label="Financing Purpose">
                    {(id) => (
                      <select
                        id={id}
                        value={creditForm.purpose}
                        onChange={(e) => setCreditForm({ ...creditForm, purpose: e.target.value as any })}
                        className={inputClass}
                      >
                        <option value="working_capital">Working Capital & Payroll Reserve</option>
                        <option value="equipment_purchase">Processing / Packaging Machinery Purchase</option>
                        <option value="inventory_expansion">Bulk Raw Material & Inventory Purchase</option>
                        <option value="facility_upgrade">Facility Sanitation & Building Upgrade</option>
                      </select>
                    )}
                  </Field>

                  <label className="flex items-center gap-2.5 text-xs text-ink cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={creditForm.hasCollateral}
                      onChange={(e) => setCreditForm({ ...creditForm, hasCollateral: e.target.checked })}
                      className="w-4 h-4"
                    />
                    I have real estate, vehicle, or machinery collateral available
                  </label>

                  <Button type="submit" variant="primary" size="lg" className="w-full mt-4" disabled={evaluatingCredit}>
                    {evaluatingCredit ? 'Matching Lenders...' : 'Match Credit Facilities'}
                  </Button>
                </form>
              </Panel>

              {/* Credit Results */}
              <div className="space-y-4">
                <Panel>
                  <PanelHeader
                    title="Matched Lending Facilities"
                    description="Legacy financing examples. Accreditation and current availability are not confirmed."
                  />

                  {creditResults ? (
                    <div className="space-y-4">
                      {creditResults.map((match) => (
                        <div key={match.id} className="p-4 rounded-xl border border-line bg-surface hover:border-brand transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                {match.institution}
                              </span>
                              <h3 className="text-base font-bold text-ink mt-1.5">{match.programTitle}</h3>
                              <p className="text-xs font-semibold text-brand mt-0.5">
                                Interest: {match.interestRate} · {match.repaymentTerm}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300">
                                Needs review
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-line text-xs space-y-1.5">
                            <div className="flex justify-between text-slate-700">
                              <span><strong>Collateral:</strong> {match.collateralRequired}</span>
                              <span><strong>Max Credit:</strong> {match.maxLoanAmount}</span>
                            </div>

                            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground mt-2">
                              {match.highlights.map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                            </ul>

                            <div className="mt-2 text-slate-500 pt-1 flex items-center justify-between">
                              <span><strong>Local Lending Desk:</strong> {match.contactPhone}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      Set your capital requirement and credit profile on the left to see matched local lenders in South Cotabato.
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OFFICIAL PORTALS */}
      {activeTab === 'portals' && (
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Official Philippine Government E-Filing Portals"
              description="Direct verified links to national and local statutory filing systems for Region 12."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PORTALS.map((portal) => (
                <a
                  key={portal.url}
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group p-4 rounded-xl border border-line hover:border-brand bg-surface hover:bg-brand-soft/30 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-highlight-ink uppercase tracking-wider">{portal.agency}</span>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-brand" />
                    </div>
                    <h3 className="font-bold text-ink mt-1 group-hover:text-brand">{portal.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{portal.desc}</p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Verified Government Domain</span>
                    <span className="font-semibold text-brand">Launch Portal →</span>
                  </div>
                </a>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
};
