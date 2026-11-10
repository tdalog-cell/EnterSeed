import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/apiClient';
import { PhotoImg } from '../components/PhotoImg';
import { PHOTOS } from '../photos';
import { Button, CheckField, Field, Notice, Panel, PanelHeader, inputClass, textareaClass } from '../components/ui';
import { ArrowUpRight, BookOpen, HeartHandshake, LockKeyhole, MapPin, MessageCircle, Send } from 'lucide-react';

const PRINCIPLES = [
  {
    title: 'Clarity for your next step',
    body: 'Turn your business questions into practical next steps, with official reference links to help you check requirements.',
    icon: BookOpen
  },
  {
    title: 'Connections closer to home',
    body: 'Discover local suppliers and understand what they offer. Check a listing’s review status and confirm terms directly before ordering.',
    icon: HeartHandshake
  },
  {
    title: 'Your workspace, your control',
    body: 'Keep your planning in one place, export your account records, and manage your saved data through the privacy tools.',
    icon: LockKeyhole
  }
];

export const AboutView: React.FC = () => {
  const { user, isDemo } = useAuth();
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
    if (!form.consent || submitting || isDemo) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await apiFetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim(), email: form.email.trim(), message: form.message.trim(), topic: form.topic.trim().length >= 3 ? form.topic.trim() : 'General question' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Your message could not be sent. Try again.');
      setStatus({ tone: 'success', text: `Your message has been received${data.reference ? `. Reference #${data.reference}` : ''}. We keep inquiries for up to 180 days.` });
      setForm(blankForm());
    } catch (err: unknown) {
      setStatus({ tone: 'error', text: err instanceof Error ? err.message : 'We couldn’t send your message. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-9 sm:space-y-12">
      <section className="grid gap-8 md:grid-cols-2 md:items-center">
        <div>
          <p className="section-label mb-4">Rooted in South Cotabato</p>
          <h1 className="text-[1.75rem] sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
            Small businesses.<br /><span className="text-brand">Room to grow.</span>
          </h1>
          <p className="mt-4 text-[15px] sm:text-base leading-relaxed text-muted max-w-xl">
            Behind every small business is someone building a better tomorrow. Enterseed brings planning tools, local connections, and business guidance together for entrepreneurs across South Cotabato and SOCCSKSARGEN.
          </p>
          <a href="#contact" onClick={(event) => { event.preventDefault(); document.getElementById('contact')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }} className="mt-6 inline-flex items-center gap-2 font-semibold text-sm text-brand hover:underline">
            Let’s talk about your business <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
        <div className="relative pb-5 pr-5">
          <div className="absolute bottom-0 right-0 top-5 left-5 rounded-[1.75rem] bg-accent-soft" aria-hidden="true" />
          <PhotoImg photo={PHOTOS.market} sizes="(min-width: 768px) 50vw, 100vw" className="h-64 sm:h-80 rounded-[1.75rem]" eager />
          <span className="absolute bottom-0 left-5 inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs font-semibold text-ink shadow-sm"><MapPin className="w-4 h-4 text-brand" /> Local roots. Shared possibilities.</span>
        </div>
      </section>

      <section aria-label="Principles" className="stagger-children grid gap-4 md:grid-cols-3">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="interactive-card rounded-2xl border border-line bg-surface p-6">
            <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><p.icon className="w-5 h-5" strokeWidth={1.5} /></span>
            <h2 className="font-bold text-ink">{p.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.7fr_1fr] lg:gap-12">
        <div className="lg:pt-5">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink"><MessageCircle className="w-5 h-5" /></span>
          <p className="section-label mt-5 mb-3">A conversation can help</p>
          <h2 className="text-2xl font-bold tracking-tight text-ink">We’re listening.</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted max-w-sm">Tell us what’s working, where you’re stuck, or what would make Enterseed more useful for your business.</p>
          <div className="mt-6 rounded-xl border border-line bg-sunken/60 p-4 text-xs leading-relaxed text-muted max-w-sm">Please leave passwords, identification numbers, and payment details out of your message. Your email helps us follow up.</div>
        </div>
      <Panel id="contact" className="scroll-mt-24">
        <PanelHeader
          title="Contact support"
          description="Questions, feedback, or a little help getting started."
        />

        {status && (
          <Notice tone={status.tone} className="mb-5">
            {status.text}
          </Notice>
        )}

        {isDemo && <Notice className="mb-5">You’re exploring the demo. Messages aren’t sent from this workspace. Sign in to a connected account to contact support.</Notice>}

        <form onSubmit={handleSubmit} aria-busy={submitting}>
          <fieldset disabled={submitting || isDemo} className="space-y-4 disabled:opacity-60">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              {(id) => <input id={id} type="text" required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />}
            </Field>
            <Field label="Email">
              {(id) => <input id={id} type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />}
            </Field>
          </div>
          <Field label="Topic" hint="Optional">
            {(id) => (
              <input id={id} type="text" maxLength={80} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Supplier listing, plan availability" className={inputClass} />
            )}
          </Field>
          <Field label="Message" hint="At least 10 characters.">
            {(id) => <textarea id={id} rows={5} required minLength={10} maxLength={3000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" className={textareaClass} />}
          </Field>
          <CheckField checked={form.consent} onChange={(consent) => setForm({ ...form, consent })}>
            Enterseed may store this message for up to 180 days to handle my request.
          </CheckField>
          <Button type="submit" size="lg" disabled={submitting || !form.consent || isDemo} busy={submitting} className="w-full sm:w-auto">
            {submitting ? 'Sending…' : 'Send message'}
            {!submitting && <Send className="w-4 h-4" />}
          </Button>
          </fieldset>
        </form>
      </Panel>
      </section>
    </div>
  );
};
