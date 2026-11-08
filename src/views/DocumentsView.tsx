import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  generateDocument,
  saveDocumentToLibrary,
  fetchGeneratedDocs,
  GeneratedDocument
} from '../services/apiClient';
import { exportDocumentAsPdf } from '../utils/pdfExport';
import {
  Download,
  Printer,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Building2,
  FolderOpen,
  FolderPlus,
  ArrowRight,
  Eye,
  Copy,
  Info
} from 'lucide-react';
import {
  Button,
  Field,
  PageHeader,
  Panel,
  PanelHeader,
  Segmented,
  Notice,
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

type DocType = 'feasibility_study' | 'business_plan' | 'grant_loan_proposal';

export const DocumentsView: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [docType, setDocType] = useState<DocType>('business_plan');
  const [businessName, setBusinessName] = useState(user?.business || 'South Cotabato Artisan Delights');
  const [municipality, setMunicipality] = useState('Tupi');
  const [sector, setSector] = useState('Agri-Processing & Specialty Coffee');
  const [targetMarket, setTargetMarket] = useState('Regional grocery stores, tourists along Koronadal-GenSan corridor, and online B2B cafes.');
  const [monthlyRevenue, setMonthlyRevenue] = useState(85000);
  const [requestedAmount, setRequestedAmount] = useState(350000);
  const [supplyChainNotes, setSupplyChainNotes] = useState('Green coffee beans sourced from Mt. Matutum smallholders; packaging boxes procured from Polomolok supplier.');

  const [generating, setGenerating] = useState(false);
  const [savingToLib, setSavingToLib] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<GeneratedDocument | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [savedDocs, setSavedDocs] = useState<GeneratedDocument[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  useEffect(() => {
    loadSavedDocuments();
  }, []);

  const loadSavedDocuments = async () => {
    try {
      setLoadingSaved(true);
      const docs = await fetchGeneratedDocs();
      setSavedDocs(docs);
      if (docs.length > 0 && !currentDoc) {
        setCurrentDoc(docs[0]);
      }
    } catch (err) {
      console.warn('Could not load saved documents:', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      if (Object.keys(next).length === 0) {
        setNotice((currentNotice) => (currentNotice?.text.includes('required fields') ? null : currentNotice));
      }
      return next;
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!businessName || businessName.trim().length < 2) {
      errors.businessName = 'Business Name is required (minimum 2 characters).';
    }
    if (!sector || sector.trim().length < 2) {
      errors.sector = 'Industry Sector is required (minimum 2 characters).';
    }
    if (!targetMarket || targetMarket.trim().length < 2) {
      errors.targetMarket = 'Target Market is required (minimum 2 characters).';
    }
    if (monthlyRevenue === undefined || monthlyRevenue === null || String(monthlyRevenue).trim() === '' || isNaN(Number(monthlyRevenue)) || Number(monthlyRevenue) < 0) {
      errors.monthlyRevenue = 'Please enter a valid non-negative monthly revenue.';
    }
    if (requestedAmount === undefined || requestedAmount === null || String(requestedAmount).trim() === '' || isNaN(Number(requestedAmount)) || Number(requestedAmount) < 0) {
      errors.requestedAmount = 'Please enter a valid non-negative capital / loan amount.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setNotice({
        tone: 'error',
        text: 'Please review the highlighted required fields before generating your document.'
      });
      return;
    }

    setFieldErrors({});
    setGenerating(true);
    setNotice(null);

    try {
      const doc = await generateDocument({
        docType,
        businessName: businessName.trim(),
        municipality,
        sector: sector.trim(),
        targetMarket: targetMarket.trim(),
        monthlyRevenue: Number(monthlyRevenue),
        requestedAmount: Number(requestedAmount),
        supplyChainNotes: supplyChainNotes.trim(),
        saveToLibrary: false // Opt-in saving requirement
      });
      setCurrentDoc(doc);
      setNotice({
        tone: 'info',
        text: `Document draft created! Review your preview below. Click "Save to Document Library" if you wish to store this document and enable Boss Narra AI context.`
      });
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Failed to generate document.' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToLibrary = async (doc: GeneratedDocument) => {
    try {
      setSavingToLib(true);
      await saveDocumentToLibrary(doc);
      await loadSavedDocuments();
      setNotice({
        tone: 'success',
        text: `Successfully saved "${doc.title}" to your Document Library! Boss Narra AI can now reference this document for contextual business advice.`
      });
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Failed to save document to library.' });
    } finally {
      setSavingToLib(false);
    }
  };

  const handleDownloadPdf = (doc: GeneratedDocument) => {
    exportDocumentAsPdf(doc);
  };

  const handlePrint = (doc: GeneratedDocument) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${doc.title}</title><style>body { font-family: sans-serif; padding: 24px; color: #1e293b; } h1, h2 { color: #4A1D8F; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; } th { background: #4A1D8F; color: white; }</style></head><body>${doc.contentHtml}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Automated MSME Document Generator"
        lead="Generate formatted Feasibility Studies, Comprehensive Business Plans, and Grant/Loan Proposals tailored for DTI, BPLO, SBCorp, and LandBank review."
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <Button
              variant={activeTab === 'create' ? 'primary' : 'secondary'}
              size="md"
              className="shrink-0"
              onClick={() => setActiveTab('create')}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Generator Studio
            </Button>
            <Button
              variant={activeTab === 'library' ? 'primary' : 'secondary'}
              size="md"
              className="shrink-0"
              onClick={() => setActiveTab('library')}
            >
              <FolderOpen className="w-4 h-4 mr-1.5" />
              Document Library ({savedDocs.length})
            </Button>
          </div>
        }
      />

      {notice && (
        <Notice tone={notice.tone} className="mb-2">
          {notice.text}
        </Notice>
      )}

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5.2fr)_minmax(0,6.8fr)] gap-6 items-start">
          {/* Generator Form */}
          <Panel>
            <PanelHeader
              title="Proposal & Plan Parameters"
              description="Input your enterprise details. The AI integrates regional South Cotabato economic indicators and 3-year viability models."
            />

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <p className="text-[13px] font-semibold text-ink mb-1.5">Document Type</p>
                <Segmented
                  label="Document Type"
                  className="w-full"
                  value={docType}
                  onChange={setDocType}
                  options={[
                    { value: 'business_plan', label: 'Business Plan' },
                    { value: 'feasibility_study', label: 'Feasibility Study' },
                    { value: 'grant_loan_proposal', label: 'Loan Proposal' }
                  ]}
                />
              </div>

              <Field label="Business Name">
                {(id) => (
                  <div>
                    <input
                      id={id}
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => {
                        setBusinessName(e.target.value);
                        clearFieldError('businessName');
                      }}
                      className={cx(inputClass, fieldErrors.businessName && 'border-red-500 ring-1 ring-red-500 bg-red-50/20')}
                    />
                    {fieldErrors.businessName && (
                      <p className="text-xs font-semibold text-red-600 mt-1">{fieldErrors.businessName}</p>
                    )}
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Municipality">
                  {(id) => (
                    <select
                      id={id}
                      value={municipality}
                      onChange={(e) => setMunicipality(e.target.value)}
                      className={inputClass}
                    >
                      {MUNICIPALITIES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )}
                </Field>

                <Field label="Industry Sector">
                  {(id) => (
                    <div>
                      <input
                        id={id}
                        type="text"
                        required
                        value={sector}
                        onChange={(e) => {
                          setSector(e.target.value);
                          clearFieldError('sector');
                        }}
                        className={cx(inputClass, fieldErrors.sector && 'border-red-500 ring-1 ring-red-500 bg-red-50/20')}
                      />
                      {fieldErrors.sector && (
                        <p className="text-xs font-semibold text-red-600 mt-1">{fieldErrors.sector}</p>
                      )}
                    </div>
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Est. Monthly Revenue (PHP)">
                  {(id) => (
                    <div>
                      <input
                        id={id}
                        type="number"
                        required
                        min={0}
                        value={monthlyRevenue}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMonthlyRevenue(val === '' ? ('' as any) : Number(val));
                          clearFieldError('monthlyRevenue');
                        }}
                        className={cx(inputClass, fieldErrors.monthlyRevenue && 'border-red-500 ring-1 ring-red-500 bg-red-50/20')}
                      />
                      {fieldErrors.monthlyRevenue && (
                        <p className="text-xs font-semibold text-red-600 mt-1">{fieldErrors.monthlyRevenue}</p>
                      )}
                    </div>
                  )}
                </Field>

                <Field label="Target Capital / Loan (PHP)">
                  {(id) => (
                    <div>
                      <input
                        id={id}
                        type="number"
                        required
                        min={0}
                        value={requestedAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRequestedAmount(val === '' ? ('' as any) : Number(val));
                          clearFieldError('requestedAmount');
                        }}
                        className={cx(inputClass, fieldErrors.requestedAmount && 'border-red-500 ring-1 ring-red-500 bg-red-50/20')}
                      />
                      {fieldErrors.requestedAmount && (
                        <p className="text-xs font-semibold text-red-600 mt-1">{fieldErrors.requestedAmount}</p>
                      )}
                    </div>
                  )}
                </Field>
              </div>

              <Field label="Target Customer Base & Market Reach">
                {(id) => (
                  <div>
                    <textarea
                      id={id}
                      rows={2}
                      required
                      value={targetMarket}
                      onChange={(e) => {
                        setTargetMarket(e.target.value);
                        clearFieldError('targetMarket');
                      }}
                      className={cx(textareaClass, fieldErrors.targetMarket && 'border-red-500 ring-1 ring-red-500 bg-red-50/20')}
                    />
                    {fieldErrors.targetMarket && (
                      <p className="text-xs font-semibold text-red-600 mt-1">{fieldErrors.targetMarket}</p>
                    )}
                  </div>
                )}
              </Field>

              <Field label="Local Supply Chain Integration (Raw Materials & Packaging)">
                {(id) => (
                  <textarea
                    id={id}
                    rows={2}
                    value={supplyChainNotes}
                    onChange={(e) => setSupplyChainNotes(e.target.value)}
                    className={textareaClass}
                  />
                )}
              </Field>

              <Button type="submit" variant="primary" size="lg" className="w-full mt-4" disabled={generating}>
                <Sparkles className="w-4 h-4 mr-1.5" />
                {generating ? 'Drafting Regulatory Document...' : 'Generate Formatted Document'}
              </Button>
            </form>
          </Panel>

          {/* Document Live Preview & Export */}
          <div className="space-y-4">
            {currentDoc ? (
              <Panel>
                {(() => {
                  const isSaved = savedDocs.some((d) => d.id === currentDoc.id);
                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                            {isSaved ? 'Saved Document' : 'Draft Preview'}
                          </span>
                          {isSaved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Saved in Library (AI Indexed)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                              <Info className="w-3 h-3" /> Opt-In: Click Save to add to library
                            </span>
                          )}
                        </div>
                        <h2 className="text-base font-bold text-ink truncate">{currentDoc.title}</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
                        {!isSaved && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="shrink-0 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                            onClick={() => handleSaveToLibrary(currentDoc)}
                            disabled={savingToLib}
                          >
                            <FolderPlus className="w-4 h-4 mr-1.5" />
                            {savingToLib ? 'Saving...' : 'Save to Document Library'}
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" className="shrink-0" onClick={() => handlePrint(currentDoc)}>
                          <Printer className="w-4 h-4 mr-1.5" />
                          Print
                        </Button>
                        <Button variant="secondary" size="sm" className="shrink-0 shadow-xs" onClick={() => handleDownloadPdf(currentDoc)}>
                          <Download className="w-4 h-4 mr-1.5" />
                          Download .PDF
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                {/* Rendered HTML content */}
                <div
                  className="prose prose-sm max-w-none bg-surface border border-line rounded-xl p-4 sm:p-6 overflow-x-auto max-h-[640px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: currentDoc.contentHtml }}
                />
              </Panel>
            ) : (
              <Panel className="text-center py-16">
                <FileText className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
                <h3 className="text-base font-bold text-ink">Ready to Generate</h3>
                <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                  Fill out the parameters on the left and click "Generate Formatted Document" to produce a publication-grade PDF document.
                </p>
              </Panel>
            )}
          </div>
        </div>
      ) : (
        /* TAB: DOCUMENT LIBRARY */
        <Panel>
          <PanelHeader
            title="Archived & Generated Business Documents"
            description="Access your previously formatted proposals, financial forecasts, and feasibility reports."
          />

          {loadingSaved ? (
            <div className="py-12 text-center text-sm text-muted">Loading documents...</div>
          ) : savedDocs.length === 0 ? (
            <div className="py-12 text-center text-muted">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-ink">No saved documents yet.</p>
              <p className="text-xs text-muted mt-1">Switch to the Generator Studio to draft your first proposal.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl border border-line bg-surface hover:border-brand flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-soft text-brand">
                        {doc.docType.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(doc.createdAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> In Library
                      </span>
                    </div>
                    <h3 className="font-bold text-ink text-base truncate">{doc.title}</h3>
                    <p className="text-xs text-muted truncate">
                      {doc.municipality}, South Cotabato · Est. Turnover: {doc.summary?.projectedRevenue ? `₱${doc.summary.projectedRevenue.toLocaleString()}` : '—'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setCurrentDoc(doc);
                        setActiveTab('create');
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      View
                    </Button>
                    <Button variant="secondary" size="sm" className="shrink-0" onClick={() => handlePrint(doc)}>
                      <Printer className="w-4 h-4 mr-1.5" />
                      Print
                    </Button>
                    <Button variant="primary" size="sm" className="shrink-0" onClick={() => handleDownloadPdf(doc)}>
                      <Download className="w-4 h-4 mr-1.5" />
                      Export .PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
};
