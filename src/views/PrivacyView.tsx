import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Modal, Notice, PageHeader, Panel, PanelHeader } from '../components/ui';
import { ShieldCheck, Download, Trash2, AlertTriangle, FileLock2, ExternalLink } from '../components/icons';

export const PrivacyView: React.FC = () => {
  const { user, exportUserData, deleteUserData } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const handleExport = async () => {
    setExporting(true); setExportError('');
    try { await exportUserData(); }
    catch (error) { setExportError(error instanceof Error ? error.message : 'Your data could not be exported. Please retry.'); }
    finally { setExporting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    const success = await deleteUserData();
    if (!success) {
      setDeleteError('Failed to delete account. Please try again or contact support.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Your business. Your information."
        title="Privacy & your data"
        lead="How Enterseed handles your business records, financial figures, and identity in compliance with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173)."
      />

      {exportError && <Notice tone="error">{exportError}</Notice>}
      {/* Trust Notice */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 text-sm leading-relaxed flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-900">Independent MSME Support Tool</p>
          <p className="mt-1 text-xs sm:text-sm text-amber-800">
            Enterseed is an independent digital tool built for MSMEs in South Cotabato and SOCCSKSARGEN. We are not an official government agency and we do not share your private financial figures or documents with tax authorities or marketing brokers.
          </p>
        </div>
      </div>

      {/* User Data Controls */}
      {user && (
        <Panel>
          <PanelHeader
            title="Your Data Rights & Self-Service Tools"
            description="Exercise your rights to data portability and complete erasure under RA 10173."
          />
          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div className="p-4 rounded-xl border border-line bg-sunken/60 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-ink text-sm">
                  <Download className="w-4 h-4 text-brand" />
                  Export My Data (Portability)
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Download your profile, financial records, registration drafts, saved documents, supplier inquiries, reviews, and this browser’s marketing drafts as a JSON file.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExport} busy={exporting} busyLabel="Preparing export…" className="mt-4 self-start">
                <Download className="w-3.5 h-3.5 mr-1" />
                Export My Data
              </Button>
            </div>

            <div className="p-4 rounded-xl border border-danger/30 bg-danger-soft/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-danger text-sm">
                  <Trash2 className="w-4 h-4 text-danger" />
                  Erase My Records (Right to Forget)
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Permanently delete your user account, login credentials, financial figures, document library drafts, and inquiry records from Enterseed.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="mt-4 self-start border-danger/40 text-danger hover:bg-danger-soft"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete My Data
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {/* RA 10173 Summary Sections */}
      <section className="bg-surface rounded-2xl border border-line p-6 space-y-6 text-sm text-ink leading-relaxed">
        <div>
          <h2 className="text-base font-bold text-ink">1. Information We Collect</h2>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
            When you use Enterseed, you may voluntarily input:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-xs sm:text-sm text-slate-700">
            <li><strong>Account Details:</strong> Name, email address, password hash, business name, and municipality in South Cotabato.</li>
            <li><strong>Financial Estimates:</strong> Self-reported monthly turnover, operating expenses, cash reserves, and debt figures used strictly for generating your runway calculations.</li>
            <li><strong>Registration Assistant Info:</strong> Business trade name, TIN number, and municipal zoning sketches prepared for your own filing packets.</li>
            <li><strong>Supplier Listings:</strong> If you apply to be listed, your public business contact email, phone number, and product catalog are verified prior to public listing.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-bold text-ink">2. Purpose of Data Processing</h2>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
            Your data is processed strictly to provide:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-xs sm:text-sm text-slate-700">
            <li>Financial runway estimates and practice-set summaries.</li>
            <li>Pre-populated statutory registration assistance packets.</li>
            <li>Personalized context for Boss Narra AI business advisory.</li>
            <li>Direct business-to-business supplier inquiries and peer reviews.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-bold text-ink">3. Storage & Retention Periods</h2>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
            Data is retained only as long as necessary:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-xs sm:text-sm text-slate-700">
            <li><strong>Anonymous Readiness Checkups:</strong> Automatically deleted after 30 days.</li>
            <li><strong>Contact Inquiries:</strong> Retained for up to 180 days to handle support requests, then purged.</li>
            <li><strong>Registered Account Records:</strong> Retained while your account is active, or until you choose "Delete My Data".</li>
          </ul>
        </div>

        <div>
          <h2 className="text-base font-bold text-ink">4. Rights of the Data Subject</h2>
          <p className="mt-1 text-muted-foreground text-xs sm:text-sm">
            Under Republic Act No. 10173, as a data subject you have the right to be informed, right of access, right to rectify inaccuracies, right to erasure or blocking, and right to damages. To submit a formal inquiry, email our support desk or use the contact form on the About page.
          </p>
        </div>

        <div className="pt-4 border-t border-line text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>National Privacy Commission (NPC) Compliance Reference</span>
          <a
            href="https://privacy.gov.ph/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
          >
            Visit National Privacy Commission Portal <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Permanently Delete All Your Data?"
      >
        <div className="space-y-4">
          {deleteError && <Notice tone="error">{deleteError}</Notice>}
          <div className="p-3 rounded-xl bg-danger-soft/40 border border-danger/30 flex items-start gap-2.5 text-danger text-xs leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Warning: This action is irreversible. All your financial assessments, registration assistant packets, generated documents, and login credentials will be permanently erased.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Are you sure you wish to delete your account ({user?.email}) and all stored business information?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-danger hover:bg-danger/90 text-white border-transparent"
            >
              {deleting ? 'Deleting...' : 'Yes, Delete My Data'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
