import React, { useState } from 'react';
import { apiFetch } from '../services/apiClient';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import { Button, CheckField, Field, Notice, PageHeader, Panel, PanelHeader, Segmented, inputClass } from '../components/ui';

const NEEDS = [
  { id: 'efiling', label: 'Government e-filing and permits checklist' },
  { id: 'feasibility', label: 'Feasibility study and loan outline' },
  { id: 'suppliers', label: 'Local supplier and packaging directory' }
];

const PORTALS = [
  {
    agency: 'DTI',
    title: 'Business Name Registration System',
    desc: 'Register and renew sole proprietorship business names and download the certificate.',
    url: 'https://bnrs.dti.gov.ph/'
  },
  {
    agency: 'BIR',
    title: 'ORUS and eServices',
    desc: 'Apply for a TIN, register books of accounts, and file with eBIRForms.',
    url: 'https://www.bir.gov.ph/'
  },
  {
    agency: 'SSS',
    title: 'My.SSS employer portal',
    desc: 'Submit monthly contribution lists (R-3) and manage employer compliance.',
    url: 'https://www.sss.gov.ph/'
  },
  {
    agency: 'PhilHealth',
    title: 'Electronic Premium Remittance System',
    desc: 'Generate your Statement of Premium Account and track premium payments.',
    url: 'https://www.philhealth.gov.ph/'
  },
  {
    agency: 'Pag-IBIG Fund',
    title: 'Virtual Pag-IBIG for employers',
    desc: 'Remit housing fund contributions and verify employee MID numbers.',
    url: 'https://www.pagibigfund.gov.ph/'
  },
  {
    agency: 'South Cotabato LGU',
    title: 'Provincial e-services',
    desc: 'Provincial business permits, agricultural clearances, and tourism accreditation.',
    url: 'https://southcotabato.gov.ph/services/'
  }
];

const TOKEN_KEY = 'enterseed_readiness_token';

export const EfilingView: React.FC = () => {
  const [stage, setStage] = useState<'unregistered' | 'registered'>('unregistered');
  const [needs, setNeeds] = useState<string[]>(['efiling', 'suppliers']);
  const [location, setLocation] = useState('City of Koronadal');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteToken, setDeleteToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const toggleNeed = (id: string) => setNeeds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || needs.length === 0) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await apiFetch('/api/readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ stage, needs, location, consent: true })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The checkup could not be saved. Try again.');
      setDeleteToken(data.deleteToken);
      try {
        sessionStorage.setItem(TOKEN_KEY, data.deleteToken);
      } catch {
        // token stays in memory for this visit
      }
      setStatus({ tone: 'success', text: 'Checkup saved for 30 days, with no name, email, or phone number.' });
    } catch (err: any) {
      setStatus({ tone: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteToken) return;
    try {
      const res = await apiFetch(`/api/readiness/${deleteToken}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setDeleteToken(null);
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        /* ignore */
      }
      setStatus({ tone: 'success', text: 'Your checkup has been deleted.' });
    } catch {
      setStatus({ tone: 'error', text: 'The checkup could not be deleted. Try again.' });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Readiness and e-filing"
        lead="Take an anonymous readiness checkup, then go straight to the official government portals you need."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
        <Panel>
          <PanelHeader
            title="Anonymous readiness checkup"
            description="We record your stage, municipality, and needs only. No name, email, or phone number. Deleted after 30 days."
          />

          {status && (
            <Notice tone={status.tone} className="mb-4">
              {status.text}
            </Notice>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <p className="text-[13px] font-semibold text-ink mb-1.5">Business stage</p>
              <Segmented
                label="Business stage"
                className="w-full"
                value={stage}
                onChange={setStage}
                options={[
                  { value: 'unregistered', label: 'Planning or unregistered' },
                  { value: 'registered', label: 'Already registered' }
                ]}
              />
            </div>

            <fieldset className="min-w-0">
              <legend className="text-[13px] font-semibold text-ink mb-2">What do you need help with?</legend>
              <div className="space-y-2.5">
                {NEEDS.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 rounded-xl border border-line-strong px-3.5 py-3 cursor-pointer hover:bg-sunken has-[:checked]:border-brand has-[:checked]:bg-brand-soft/50">
                    <input type="checkbox" checked={needs.includes(item.id)} onChange={() => toggleNeed(item.id)} className="w-4 h-4 shrink-0" />
                    <span className="text-sm text-ink">{item.label}</span>
                  </label>
                ))}
              </div>
              {needs.length === 0 && <p className="mt-2 text-xs text-danger">Choose at least one.</p>}
            </fieldset>

            <Field label="Municipality">
              {(id) => <input id={id} type="text" required value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />}
            </Field>

            <CheckField checked={consent} onChange={setConsent}>
              Store this anonymous checkup for up to 30 days so I can get local guidance.
            </CheckField>

            <Button type="submit" size="lg" className="w-full" disabled={submitting || !consent || needs.length === 0}>
              {submitting ? 'Saving…' : 'Save checkup'}
            </Button>
          </form>

          {deleteToken && (
            <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-muted">You saved a checkup this visit.</span>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 />
                Delete it now
              </Button>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Government e-filing portals" description="Official online services for sole proprietors, partnerships, and cooperatives in Region 12." />
          <ul className="divide-y divide-line -my-1">
            {PORTALS.map((portal) => (
              <li key={portal.url}>
                <a
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-4 py-4 -mx-2 px-2 rounded-lg hover:bg-sunken transition-colors"
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-accent-ink">{portal.agency}</span>
                    <span className="block mt-0.5 font-semibold text-ink group-hover:text-brand">{portal.title}</span>
                    <span className="block mt-1 text-sm leading-relaxed text-muted">{portal.desc}</span>
                  </span>
                  <ArrowUpRight className="w-5 h-5 mt-1 shrink-0 text-muted group-hover:text-brand transition-colors" aria-label="Opens in a new tab" />
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
};
