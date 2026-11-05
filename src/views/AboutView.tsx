import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/apiClient';
import { PhotoImg } from '../components/PhotoImg';
import { PHOTOS } from '../photos';
import { Button, CheckField, Field, Notice, Panel, PanelHeader, inputClass, textareaClass } from '../components/ui';

const PRINCIPLES = [
  {
    title: 'Grounded guidance',
    body: 'Boss Narra follows strict rules against guessing at legal, tax, and loan facts, and links every answer to DTI, BIR, or DOST.'
  },
  {
    title: 'Reviewed suppliers only',
    body: 'No supplier is listed until they opt in and pass a five-point staff check of identity, registration, location, and consent.'
  },
  {
    title: 'Your data, your call',
    body: 'Financial figures stay private to your account. Anonymous checkups are deleted after 30 days; inquiries after 180, or sooner on request.'
  }
];

export const AboutView: React.FC = () => {
  const { user } = useAuth();
  const blankForm = () => ({
    name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
    email: user?.email || '',
    topic: '',
    message: '',
    consent: false
  });

  const [form, setForm] = useState(blankForm);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await apiFetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...form, topic: form.topic.trim().length >= 3 ? form.topic.trim() : 'General question' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Your message could not be sent. Try again.');
      setStatus({ tone: 'success', text: `Sent. Your reference is #${data.reference}. We keep inquiries for up to 180 days.` });
      setForm(blankForm());
    } catch (err: any) {
      setStatus({ tone: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="grid gap-6 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="text-[1.75rem] sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
            Built for the businesses of South Cotabato
          </h1>
          <p className="mt-4 text-[15px] sm:text-base leading-relaxed text-muted max-w-xl">
            Enterseed helps micro, small, and medium enterprises across South Cotabato and SOCCSKSARGEN with grounded AI
            advice, a reviewed local supplier directory, and clear compliance roadmaps.
          </p>
        </div>
        <PhotoImg photo={PHOTOS.market} sizes="(min-width: 768px) 50vw, 100vw" className="h-56 sm:h-72 rounded-2xl" eager />
      </section>

      <section aria-label="Principles" className="grid gap-x-8 gap-y-6 md:grid-cols-3 border-y border-line py-8">
        {PRINCIPLES.map((p) => (
          <div key={p.title}>
            <h2 className="font-bold text-ink">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
          </div>
        ))}
      </section>

      <Panel id="contact" className="max-w-2xl">
        <PanelHeader
          title="Contact support"
          description="Questions about supplier verification, plans, or the workspace tools? Our staff read every message."
        />

        {status && (
          <Notice tone={status.tone} className="mb-5">
            {status.text}
          </Notice>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              {(id) => <input id={id} type="text" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />}
            </Field>
            <Field label="Email">
              {(id) => <input id={id} type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />}
            </Field>
          </div>
          <Field label="Topic" hint="Optional">
            {(id) => (
              <input id={id} type="text" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Supplier listing, Pro plan" className={inputClass} />
            )}
          </Field>
          <Field label="Message" hint="At least 10 characters.">
            {(id) => <textarea id={id} rows={5} required minLength={10} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={textareaClass} />}
          </Field>
          <CheckField checked={form.consent} onChange={(consent) => setForm({ ...form, consent })}>
            Enterseed may store this message for up to 180 days to handle my request.
          </CheckField>
          <Button type="submit" size="lg" disabled={submitting || !form.consent}>
            {submitting ? 'Sending…' : 'Send message'}
          </Button>
        </form>
      </Panel>
    </div>
  );
};
