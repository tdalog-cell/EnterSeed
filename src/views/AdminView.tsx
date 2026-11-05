import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';
import { Mail, RefreshCw } from 'lucide-react';
import {
  Button,
  CheckField,
  Field,
  Modal,
  Notice,
  PageHeader,
  Panel,
  cx,
  inputClass,
  textareaClass
} from '../components/ui';

interface SupplierApplication {
  id: number;
  businessName: string;
  contactName: string;
  contactEmail: string;
  publicEmail: string;
  publicPhone: string;
  publishContact: number;
  category: string;
  location: string;
  products: string;
  website: string;
  consentAt: string;
  createdAt: string;
}

interface AdminSupplier {
  id: number;
  businessName: string;
  category: string;
  location: string;
  verifiedAt: string;
  expiresAt: string;
  status: 'active' | 'withdrawn';
}

interface AdminInquiry {
  id: number;
  name: string;
  email: string;
  topic: string;
  message: string;
  createdAt: string;
}

type Tab = 'applications' | 'suppliers' | 'inquiries';
type PendingAction = { kind: 'withdraw' | 'delete-supplier' | 'delete-inquiry'; id: number } | null;

const CHECKS = [
  { key: 'identityConfirmed', label: 'Applicant identity confirmed' },
  { key: 'businessEvidenceReviewed', label: 'Business registration or commercial evidence reviewed' },
  { key: 'contactConfirmed', label: 'Contact details confirmed' },
  { key: 'locationConfirmed', label: 'Municipality or location verified' },
  { key: 'listingConsentConfirmed', label: 'Explicit consent to publish verified' }
] as const;

type CheckKey = (typeof CHECKS)[number]['key'];

const freshChecks = (): Record<CheckKey, boolean> & { reviewNotes: string } => ({
  identityConfirmed: false,
  businessEvidenceReviewed: false,
  contactConfirmed: false,
  locationConfirmed: false,
  listingConsentConfirmed: false,
  reviewNotes: 'Identity, commercial documents, and publication consent reviewed and confirmed valid.'
});

const KEY_STORAGE = 'enterseed_admin_key';

export const AdminView: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem(KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('applications');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [applications, setApplications] = useState<SupplierApplication[]>([]);
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([]);
  const [inquiries, setInquiries] = useState<AdminInquiry[]>([]);

  const [approvingApp, setApprovingApp] = useState<SupplierApplication | null>(null);
  const [approvalChecks, setApprovalChecks] = useState(freshChecks);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const [rejectingApp, setRejectingApp] = useState<SupplierApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('Insufficient commercial proof of business registration in Region 12.');
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [pending, setPending] = useState<PendingAction>(null);

  const authHeaders = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${apiKey}`, ...extra });

  const fetchData = async (keyToUse = apiKey) => {
    if (!keyToUse) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const headers = { Authorization: `Bearer ${keyToUse}`, Accept: 'application/json' };
      const [appsRes, supsRes, inqsRes] = await Promise.all([
        apiFetch('/api/admin/supplier-applications', { headers }),
        apiFetch('/api/admin/suppliers', { headers }),
        apiFetch('/api/admin/inquiries', { headers })
      ]);
      if ([appsRes, supsRes, inqsRes].some((r) => r.status === 401)) {
        throw new Error('That admin key was not accepted. Check it and try again.');
      }
      if (appsRes.status === 503 || supsRes.status === 503) {
        throw new Error('The admin key is not configured on the server. Set ADMIN_API_KEY in .env.');
      }
      const [appsData, supsData, inqsData] = await Promise.all([appsRes.json(), supsRes.json(), inqsRes.json()]);
      setApplications(appsData.applications || []);
      setSuppliers(supsData.suppliers || []);
      setInquiries(inqsData.inquiries || []);
      setIsAuthenticated(true);
      try {
        localStorage.setItem(KEY_STORAGE, keyToUse);
      } catch {
        /* session only */
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not reach the server.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (apiKey) fetchData(apiKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allChecked = CHECKS.every((c) => approvalChecks[c.key]);
  const notesOk = approvalChecks.reviewNotes.trim().length >= 20;

  const handleApprove = async () => {
    if (!approvingApp) return;
    if (!allChecked || !notesOk) {
      setApprovalError('Confirm all five checks and write a review note of at least 20 characters.');
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/supplier-applications/${approvingApp.id}/approve`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify({
          identityConfirmed: true,
          businessEvidenceReviewed: true,
          contactConfirmed: true,
          locationConfirmed: true,
          listingConsentConfirmed: true,
          reviewNotes: approvalChecks.reviewNotes.trim()
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Approval failed.');
      }
      setApprovingApp(null);
      fetchData();
    } catch (err: any) {
      setApprovalError(err.message);
    }
  };

  const handleReject = async () => {
    if (!rejectingApp) return;
    if (rejectReason.trim().length < 10) {
      setRejectError('Write a reason of at least 10 characters.');
      return;
    }
    try {
      const res = await apiFetch(`/api/admin/supplier-applications/${rejectingApp.id}/reject`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Rejection failed.');
      }
      setRejectingApp(null);
      fetchData();
    } catch (err: any) {
      setRejectError(err.message);
    }
  };

  const runPending = async () => {
    if (!pending) return;
    const { kind, id } = pending;
    setPending(null);
    setActionError(null);
    const req =
      kind === 'withdraw'
        ? { url: `/api/admin/suppliers/${id}/withdraw`, method: 'POST', fail: 'The supplier could not be withdrawn.' }
        : kind === 'delete-supplier'
        ? { url: `/api/admin/suppliers/${id}`, method: 'DELETE', fail: 'The supplier could not be deleted.' }
        : { url: `/api/admin/inquiries/${id}`, method: 'DELETE', fail: 'The inquiry could not be deleted.' };
    try {
      const res = await apiFetch(req.url, { method: req.method, headers: authHeaders() });
      if (!res.ok) throw new Error();
      fetchData();
    } catch {
      setActionError(req.fail);
    }
  };

  const confirmInline = (kind: NonNullable<PendingAction>['kind'], id: number, label: string, prompt: string) =>
    pending?.kind === kind && pending.id === id ? (
      <span className="inline-flex items-center gap-1.5" role="group" aria-label={prompt}>
        <span className="text-[13px] text-muted">{prompt}</span>
        <Button variant="danger" size="sm" onClick={runPending}>
          Yes
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
          No
        </Button>
      </span>
    ) : (
      <Button variant="danger" size="sm" onClick={() => setPending({ kind, id })}>
        {label}
      </Button>
    );

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'applications', label: 'Applications', count: applications.length },
    { id: 'suppliers', label: 'Suppliers', count: suppliers.length },
    { id: 'inquiries', label: 'Inquiries', count: inquiries.length }
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Staff review console"
        lead="Review supplier applications, manage directory listings, and answer inquiries."
        actions={
          isAuthenticated && (
            <>
              <Button variant="secondary" size="sm" onClick={() => fetchData()} disabled={loading}>
                <RefreshCw className={loading ? 'animate-spin' : undefined} />
                Refresh
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAuthenticated(false);
                  setApiKey('');
                  try {
                    localStorage.removeItem(KEY_STORAGE);
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Lock console
              </Button>
            </>
          )
        }
      />

      {!isAuthenticated ? (
        <Panel className="max-w-md">
          <h2 className="text-lg font-bold text-ink">Staff access</h2>
          <p className="mt-1 mb-5 text-sm text-muted">Enter the server’s admin key to open the review queue.</p>
          {errorMsg && (
            <Notice tone="error" className="mb-4">
              {errorMsg}
            </Notice>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchData();
            }}
            className="space-y-4"
          >
            <Field label="Admin key">
              {(id) => (
                <input id={id} type="password" required autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className={inputClass} />
              )}
            </Field>
            <Button type="submit" className="w-full" disabled={loading || !apiKey.trim()}>
              {loading ? 'Checking…' : 'Open console'}
            </Button>
          </form>
        </Panel>
      ) : (
        <div className="space-y-5">
          {actionError && <Notice tone="error">{actionError}</Notice>}

          <div role="tablist" aria-label="Review queues" className="flex gap-1 border-b border-line overflow-x-auto">
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.id)}
                  className={cx(
                    'relative h-11 px-3.5 text-sm font-semibold whitespace-nowrap transition-colors',
                    active ? 'text-brand' : 'text-muted hover:text-ink'
                  )}
                >
                  {t.label}
                  <span className={cx('ml-1.5 rounded-full px-1.5 py-0.5 text-xs tnum', active ? 'bg-brand-soft' : 'bg-sunken')}>{t.count}</span>
                  {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
                </button>
              );
            })}
          </div>

          {activeTab === 'applications' &&
            (applications.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">No applications waiting for review.</p>
            ) : (
              <ul className="space-y-3">
                {applications.map((app) => (
                  <li key={app.id} className="bg-surface rounded-2xl border border-line p-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink">{app.businessName}</h3>
                      <p className="mt-0.5 text-[13px] text-muted capitalize">
                        {app.category.replace('-', ' ')} · {app.location}
                      </p>
                      <p className="mt-3 text-sm text-ink">{app.products}</p>
                      <p className="mt-2 text-[13px] text-muted break-words">
                        {app.contactName} · {app.contactEmail}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => {
                          setApprovalChecks(freshChecks());
                          setApprovalError(null);
                          setApprovingApp(app);
                        }}
                      >
                        Review and approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setRejectError(null);
                          setRejectingApp(app);
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {activeTab === 'suppliers' &&
            (suppliers.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">No suppliers in the directory yet.</p>
            ) : (
              <Panel className="p-0 sm:p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-sunken text-[13px] text-muted">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Business</th>
                        <th className="px-3 py-3 font-semibold">Location</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                        <th className="px-3 py-3 font-semibold">Verified</th>
                        <th className="px-5 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {suppliers.map((s) => (
                        <tr key={s.id}>
                          <td className="px-5 py-3">
                            <span className="block font-semibold text-ink">{s.businessName}</span>
                            <span className="block text-[13px] text-muted capitalize">{s.category.replace('-', ' ')}</span>
                          </td>
                          <td className="px-3 py-3 text-muted">{s.location}</td>
                          <td className="px-3 py-3">
                            <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', s.status === 'active' ? 'bg-good-soft text-good' : 'bg-sunken text-muted')}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-muted tnum">{new Date(s.verifiedAt).toLocaleDateString('en-PH')}</td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1">
                              {s.status === 'active' && confirmInline('withdraw', s.id, 'Withdraw', 'Withdraw?')}
                              {confirmInline('delete-supplier', s.id, 'Delete', 'Erase record?')}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))}

          {activeTab === 'inquiries' &&
            (inquiries.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted">No inquiries yet.</p>
            ) : (
              <ul className="space-y-3">
                {inquiries.map((inq) => (
                  <li key={inq.id} className="bg-surface rounded-2xl border border-line p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-bold text-ink">{inq.topic}</h3>
                      <span className="text-xs text-muted tnum">{new Date(inq.createdAt).toLocaleString('en-PH')}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted break-words">
                      {inq.name} · {inq.email}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink whitespace-pre-wrap">{inq.message}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <a
                        href={`mailto:${inq.email}?subject=${encodeURIComponent(`Re: [Enterseed] ${inq.topic}`)}`}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold text-brand hover:bg-brand-soft"
                      >
                        <Mail className="w-4 h-4" />
                        Reply by email
                      </a>
                      {confirmInline('delete-inquiry', inq.id, 'Delete', 'Delete inquiry?')}
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      )}

      <Modal
        open={!!approvingApp}
        onClose={() => setApprovingApp(null)}
        title={approvingApp ? `Approve ${approvingApp.businessName}` : ''}
        description="Publishing requires all five checks."
      >
        <div className="space-y-4">
          {approvalError && <Notice tone="error">{approvalError}</Notice>}
          <fieldset className="space-y-3">
            <legend className="sr-only">Verification checks</legend>
            {CHECKS.map((c) => (
              <CheckField key={c.key} checked={approvalChecks[c.key]} onChange={(v) => setApprovalChecks({ ...approvalChecks, [c.key]: v })}>
                <span className="text-ink">{c.label}</span>
              </CheckField>
            ))}
          </fieldset>
          <Field label="Review notes" hint={`${approvalChecks.reviewNotes.trim().length} / 20 characters minimum`}>
            {(id) => (
              <textarea id={id} rows={3} value={approvalChecks.reviewNotes} onChange={(e) => setApprovalChecks({ ...approvalChecks, reviewNotes: e.target.value })} className={textareaClass} />
            )}
          </Field>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setApprovingApp(null)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleApprove} disabled={!allChecked || !notesOk}>
              Approve and publish
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!rejectingApp} onClose={() => setRejectingApp(null)} title={rejectingApp ? `Reject ${rejectingApp.businessName}` : ''}>
        <div className="space-y-4">
          {rejectError && <Notice tone="error">{rejectError}</Notice>}
          <Field label="Reason" hint="At least 10 characters.">
            {(id) => <textarea id={id} rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className={textareaClass} />}
          </Field>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setRejectingApp(null)}>
              Cancel
            </Button>
            <Button className="flex-1 !bg-danger hover:!bg-[#912018] !text-white" onClick={handleReject}>
              Reject application
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
