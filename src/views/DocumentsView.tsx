import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  generateDocument,
  saveDocumentToLibrary,
  fetchGeneratedDocs,
  GeneratedDocument
} from '../services/apiClient';
import { exportDocumentAsPdf } from '../utils/pdfExport';
import { sanitizeDocumentHtml } from '../utils/documentHtml';
import { useUnsavedChanges } from '../utils/useUnsavedChanges';
import {
  Download,
  Printer,
  FileText,
  Sparkles,
  CheckCircle2,
  Building2,
  FolderOpen,
  FolderPlus,
  ArrowRight,
  Eye,
  Edit3,
  Info,
  ShieldAlert,
  ListChecks
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

const SAMPLE_OUTLINES: Record<DocType, { title: string; sections: { name: string; desc: string }[] }> = {
  business_plan: {
    title: 'Business Plan Draft Structure',
    sections: [
      { name: '1. Executive Summary', desc: 'Enterprise overview, mission, core coffee products, and funding goals.' },
      { name: '2. Market & Competitor Analysis', desc: 'Regional customer demand across Koronadal, GenSan, and tourist corridors.' },
      { name: '3. Operations & Supply Chain', desc: 'Farm-gate sourcing from Mt. Matutum growers and local packaging materials.' },
      { name: '4. Financial Projections & Cash Flow', desc: 'Estimated monthly turnover, gross profit margins, and operating runway.' }
    ]
  },
  feasibility_study: {
    title: 'Feasibility Study Draft Structure',
    sections: [
      { name: '1. Project Background', desc: 'Objective of expansion and local economic readiness.' },
      { name: '2. Technical & Production Feasibility', desc: 'Roasting capacity, equipment requirements, and power/facility needs.' },
      { name: '3. Market Viability', desc: 'Target customer segments, wholesale pricing, and distribution channels.' },
      { name: '4. Financial Viability & Payback Schedule', desc: 'Break-even sales threshold and capital payback duration.' }
    ]
  },
  grant_loan_proposal: {
    title: 'Loan & Grant Proposal Structure',
    sections: [
      { name: '1. Capital Request Summary', desc: 'Target financing amount and requested terms for SBCorp / LandBank.' },
      { name: '2. Fund Utilization Breakdown', desc: 'Itemized equipment, raw material inventory, and facility upgrades.' },
      { name: '3. Local Employment & Economic Impact', desc: 'Jobs created for local youth and support for South Cotabato growers.' },
      { name: '4. Repayment Capacity & Security', desc: 'Debt service coverage from operating cash flow.' }
    ]
  }
};

export const DocumentsView: React.FC = () => {
  const { user, isDemo } = useAuth();

  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [docType, setDocType] = useState<DocType>('business_plan');
  const [businessName, setBusinessName] = useState(user?.business || 'Matutum Highlands Coffee Roasters');
  const [municipality, setMunicipality] = useState(user?.municipality || 'City of Koronadal');
  const [sector, setSector] = useState(isDemo ? 'Coffee Roasting & Agri-Processing' : '');
  const [targetMarket, setTargetMarket] = useState(isDemo ? 'Regional cafes, local shops, and online retail customers.' : '');
  const [monthlyRevenue, setMonthlyRevenue] = useState(isDemo ? 180000 : 0);
  const [requestedAmount, setRequestedAmount] = useState(isDemo ? 350000 : 0);
  const [supplyChainNotes, setSupplyChainNotes] = useState(isDemo ? 'Example: source coffee from local growers and packaging from a nearby supplier.' : '');

  const [generating, setGenerating] = useState(false);
  const [savingToLib, setSavingToLib] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<GeneratedDocument | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Editable Preview State
  const [isEditing, setIsEditing] = useState(false);
  const [editableHtml, setEditableHtml] = useState('');

  const [savedDocs, setSavedDocs] = useState<GeneratedDocument[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  useUnsavedChanges(Boolean(currentDoc && (editableHtml !== currentDoc.contentHtml || !savedDocs.some(doc => doc.id === currentDoc.id))));

  useEffect(() => {
    loadSavedDocuments();
  }, []);

  const loadSavedDocuments = async () => {
    try {
      setLoadingSaved(true);
      setLibraryError('');
      const docs = await fetchGeneratedDocs();
      setSavedDocs(docs);
      if (docs.length > 0 && !currentDoc) {
        setCurrentDoc(docs[0]);
        setEditableHtml(docs[0].contentHtml);
      }
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Your document library could not load.');
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
        saveToLibrary: false
      });
      setCurrentDoc(doc);
      setEditableHtml(doc.contentHtml);
      setIsEditing(false);
      setNotice({
        tone: 'info',
        text: `Document draft created! Review and edit the draft below before downloading or saving to your Document Library.`
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
      const updatedDoc = { ...doc, contentHtml: sanitizeDocumentHtml(editableHtml || doc.contentHtml) };
      const savedDoc = await saveDocumentToLibrary(updatedDoc);
      setCurrentDoc(savedDoc);
      setEditableHtml(savedDoc.contentHtml);
      await loadSavedDocuments();
      setNotice({
        tone: 'success',
        text: `Saved "${doc.title}" to your document library.`
      });
    } catch (err: any) {
      setNotice({ tone: 'error', text: err.message || 'Failed to save document to library.' });
    } finally {
      setSavingToLib(false);
    }
  };

  const handleDownloadPdf = (doc: GeneratedDocument) => {
    const updatedDoc = { ...doc, contentHtml: sanitizeDocumentHtml(editableHtml || doc.contentHtml) };
    exportDocumentAsPdf(updatedDoc);
  };

  const handlePrint = (doc: GeneratedDocument) => {
    const content = sanitizeDocumentHtml(editableHtml || doc.contentHtml);
    const w = window.open('', '_blank');
    if (!w) { setNotice({ tone: 'error', text: 'Allow pop-ups for this site to open the print preview.' }); return; }
    w.opener = null;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Enterseed document</title><style>body { font-family: sans-serif; padding: 24px; color: #1e293b; } h1, h2 { color: #4A1D8F; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; } th { background: #4A1D8F; color: white; }</style></head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="From idea to a first draft"
        title="Your document studio"
        lead="Draft structured Business Plans, Feasibility Studies, and Loan Proposals for South Cotabato MSMEs. All generated drafts are editable templates and should be verified before official submission."
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

      {libraryError && <Notice tone="error">{libraryError}<button type="button" onClick={loadSavedDocuments} className="ml-2 font-semibold underline">Retry library</button></Notice>}
      {notice && (
        <Notice tone={notice.tone} className="mb-2">
          {notice.text}
        </Notice>
      )}

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
          {/* Generator Form */}
          <Panel>
            <PanelHeader
              title="Proposal & Plan Parameters"
              description="Enter your business details to draft a structured proposal. You can edit the text before exporting."
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Est. Monthly Revenue (₱)">
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

                <Field label="Target Capital / Loan (₱)">
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

              <Field label="Local Supply Chain Sourcing">
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
                {generating ? 'Drafting Document...' : 'Generate Formatted Document'}
              </Button>
            </form>
          </Panel>

          {/* Document Live Preview, Editable Mode & Export */}
          <div className="space-y-4">
            {currentDoc ? (
              <Panel>
                {(() => {
                  const isSaved = savedDocs.some((d) => d.id === currentDoc.id && d.contentHtml === editableHtml);
                  return (
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-line">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                              {isSaved ? 'Saved Document' : 'Draft Preview'}
                            </span>
                            {isSaved ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Saved in Library
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                <Info className="w-3 h-3" /> Review before saving
                              </span>
                            )}
                          </div>
                          <h2 className="text-base font-bold text-ink truncate">{currentDoc.title}</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsEditing(!isEditing)}
                            className={cx(isEditing && 'bg-brand text-white hover:bg-brand-dark')}
                          >
                            <Edit3 className="w-4 h-4 mr-1.5" />
                            {isEditing ? 'Done Editing' : 'Edit Text'}
                          </Button>
                          {!isSaved && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                              onClick={() => handleSaveToLibrary(currentDoc)}
                              disabled={savingToLib}
                            >
                              <FolderPlus className="w-4 h-4 mr-1.5" />
                              {savingToLib ? 'Saving...' : 'Save to Library'}
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => handlePrint(currentDoc)}>
                            <Printer className="w-4 h-4 mr-1.5" />
                            Print
                          </Button>
                          <Button variant="secondary" size="sm" className="shrink-0" onClick={() => handleDownloadPdf(currentDoc)}>
                            <Download className="w-4 h-4 mr-1.5" />
                            PDF
                          </Button>
                        </div>
                      </div>

                      {/* AI Review Disclaimer Callout */}
                      <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <p>
                          <strong>AI-Generated Draft:</strong> Always review and verify numbers, local terms, and operational details before presenting this document to lenders or government reviewers.
                        </p>
                      </div>

                      {/* Rendered HTML content or Editable Textarea */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-ink">Edit Document HTML / Content:</label>
                          <textarea
                            aria-label="Edit document content"
                            value={editableHtml}
                            onChange={(e) => setEditableHtml(e.target.value)}
                            rows={18}
                            className={cx(textareaClass, 'font-mono text-xs leading-relaxed')}
                          />
                          <p className="text-[11px] text-muted">
                            Tip: You can edit headings, numbers, and paragraphs directly. Click "Done Editing" to return to preview mode.
                          </p>
                        </div>
                      ) : (
                        <div
                          className="document-prose max-w-none bg-surface border border-line rounded-xl p-4 sm:p-6 overflow-x-auto max-h-[640px] overflow-y-auto"
                          dangerouslySetInnerHTML={{ __html: sanitizeDocumentHtml(editableHtml || currentDoc.contentHtml) }}
                        />
                      )}
                    </div>
                  );
                })()}
              </Panel>
            ) : (
              /* Live Sample Outline Preview instead of blank box */
              <Panel>
                <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <ListChecks className="w-4 h-4 text-purple-700" />
                    <h3 className="text-sm font-bold text-purple-950">
                      {SAMPLE_OUTLINES[docType].title}
                    </h3>
                  </div>
                  <p className="text-xs text-purple-800 leading-relaxed mb-4">
                    When you click "Generate Formatted Document", Enterseed will produce an editable draft incorporating the following sections:
                  </p>
                  <div className="space-y-3">
                    {SAMPLE_OUTLINES[docType].sections.map((sec, idx) => (
                      <div key={idx} className="bg-surface p-3 rounded-lg border border-purple-100 shadow-2xs">
                        <strong className="text-xs font-bold text-ink block">{sec.name}</strong>
                        <span className="text-[11px] text-muted leading-relaxed block mt-0.5">{sec.desc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-purple-200 flex items-center justify-between text-xs text-purple-900 font-semibold">
                    <span>Fill in the parameters on the left to generate</span>
                    <span>Editable prior to PDF export →</span>
                  </div>
                </div>
              </Panel>
            )}
          </div>
        </div>
      ) : (
        /* TAB: DOCUMENT LIBRARY */
        <Panel>
          <PanelHeader
            title="Archived & Generated Business Documents"
            description="Access your saved proposals, financial plans, and feasibility reports. Saved documents are indexed so Boss Narra AI can reference your business context."
          />

          {loadingSaved ? (
            <div className="py-12 text-center text-sm text-muted">Loading documents...</div>
          ) : savedDocs.length === 0 ? (
            <div className="py-12 text-center text-muted">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-ink">No saved documents yet.</p>
              <p className="text-xs text-muted mt-1">Generate a proposal in the Generator Studio and click "Save to Library".</p>
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
                        {doc.docType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted">
                        {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Indexed for Boss Narra
                      </span>
                    </div>
                    <h3 className="font-bold text-ink text-base truncate">{doc.title}</h3>
                    <p className="text-xs text-muted truncate">
                      {doc.municipality}, South Cotabato · Est. Turnover: {doc.summary?.projectedRevenue ? `₱${doc.summary.projectedRevenue.toLocaleString('en-PH')}` : '—'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setCurrentDoc(doc);
                        setEditableHtml(doc.contentHtml);
                        setIsEditing(false);
                        setActiveTab('create');
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1.5" />
                      View / Edit
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
