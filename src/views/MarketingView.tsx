import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/apiClient';
import { SupplierMap } from '../components/SupplierMap';
import { SubsidyEstimator } from '../components/SubsidyEstimator';
import { PhotoImg } from '../components/PhotoImg';
import { PHOTOS } from '../photos';
import {
  Button,
  CheckField,
  Field,
  Modal,
  Notice,
  PageHeader,
  Panel,
  PanelHeader,
  cx,
  inputClass,
  textareaClass
} from '../components/ui';
import { Mail, Phone, MapPin, Plus, Search, BadgeCheck } from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  category: string;
  location: string;
  products: string;
  publicEmail?: string;
  publicPhone?: string;
  website?: string;
  verifiedAt: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'raw-materials', label: 'Raw materials' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'services', label: 'Services & logistics' },
  { id: 'marketing', label: 'Marketing & media' }
];

const FOUR_PS = [
  {
    p: 'Product',
    title: 'Value and differentiation',
    body: 'Build on local ingredients like Tupi coffee, Lake Sebu abaca, and Surallah rice, with FDA/LTO-compliant packaging.'
  },
  {
    p: 'Price',
    title: 'Cost-plus and margin',
    body: 'Price in fuel, packaging, and freight across Mindanao highways so rising costs do not eat your gross margin.'
  },
  {
    p: 'Place',
    title: 'Channels and logistics',
    body: 'Combine trade fairs like the T’nalak Festival and Negosyo Centers with direct online orders and delivery.'
  },
  {
    p: 'Promotion',
    title: 'Community storytelling',
    body: 'Show heritage, craft, and provincial pride. Use short social video and DTI showcase programs.'
  }
];

export const MarketingView: React.FC = () => {
  const { user } = useAuth();
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selected, setSelected] = useState<Supplier | null>(null);
  const mapAnchor = useRef<HTMLDivElement>(null);

  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({
    businessName: '',
    contactName: fullName,
    contactEmail: user?.email || '',
    publicEmail: user?.email || '',
    publicPhone: '',
    publishContact: true,
    category: 'packaging',
    location: 'City of Koronadal',
    products: '',
    website: '',
    consent: true
  });
  const [applyStatus, setApplyStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [applySubmitting, setApplySubmitting] = useState(false);

  const [introSupplier, setIntroSupplier] = useState<Supplier | null>(null);
  const [introForm, setIntroForm] = useState({ name: fullName, email: user?.email || '', message: '', consent: true });
  const [introStatus, setIntroStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [introSubmitting, setIntroSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/suppliers', { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = suppliers.filter(
    (s) =>
      (activeCategory === 'all' || s.category === activeCategory) &&
      (!q || [s.name, s.location, s.category, s.products].some((f) => f.toLowerCase().includes(q)))
  );

  const postJson = async (url: string, body: unknown) => {
    const res = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
    return data;
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplySubmitting(true);
    setApplyStatus(null);
    try {
      await postJson('/api/supplier-applications', applyForm);
      setApplyStatus({
        tone: 'success',
        text: 'Application sent. Staff will check your identity, business documents, and location before anything is published.'
      });
    } catch (err: any) {
      setApplyStatus({ tone: 'error', text: err.message });
    } finally {
      setApplySubmitting(false);
    }
  };

  const handleIntroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!introSupplier) return;
    setIntroSubmitting(true);
    setIntroStatus(null);
    try {
      await postJson(`/api/suppliers/${introSupplier.id}/contact`, introForm);
      setIntroStatus({ tone: 'success', text: 'Request sent. The supplier or Enterseed support will reply by email.' });
    } catch (err: any) {
      setIntroStatus({ tone: 'error', text: err.message });
    } finally {
      setIntroSubmitting(false);
    }
  };

  const closeApply = () => {
    setShowApply(false);
    setApplyStatus(null);
  };
  const closeIntro = () => {
    setIntroSupplier(null);
    setIntroStatus(null);
  };

  const showOnMap = (s: Supplier) => {
    setSelected(s);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      mapAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-end">
        <PageHeader
          title="Marketing and suppliers"
          lead="Plan your 4Ps with local context, estimate your shipping subsidy, and find suppliers that Enterseed staff have reviewed."
        />
        <PhotoImg photo={PHOTOS.fruitStand} sizes="(min-width: 768px) 320px, 100vw" className="h-40 md:h-36 rounded-2xl" eager />
      </div>

      {/* 4Ps */}
      <Panel>
        <PanelHeader title="The 4Ps for South Cotabato" />
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {FOUR_PS.map((item) => (
            <div key={item.p}>
              <dt>
                <span className="block text-[13px] font-semibold text-accent-ink">{item.p}</span>
                <span className="block mt-0.5 font-semibold text-ink">{item.title}</span>
              </dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <SubsidyEstimator />

      {/* Directory */}
      <section aria-labelledby="directory-h" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="directory-h" className="text-xl font-bold text-ink">
              Reviewed suppliers
            </h2>
            <p className="mt-1 text-sm text-muted">
              Listed only after opting in and passing a five-point staff review.
            </p>
          </div>
          <Button onClick={() => setShowApply(true)} className="self-start sm:self-auto">
            <Plus />
            List your business
          </Button>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-80 shrink-0">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplier, town, or product"
              aria-label="Search suppliers"
              className={cx(inputClass, 'pl-10')}
            />
          </div>
          <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto [scrollbar-width:none]">
            <div className="flex gap-1.5 w-max" role="group" aria-label="Filter by category">
              {CATEGORIES.map((c) => {
                const active = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveCategory(c.id)}
                    className={cx(
                      'h-9 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors border',
                      active ? 'bg-brand text-white border-brand' : 'bg-surface text-muted border-line-strong hover:text-ink'
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
          <div ref={mapAnchor} className="lg:sticky lg:top-20 scroll-mt-20">
            <SupplierMap suppliers={suppliers} selectedSupplier={selected} onSelectSupplier={(s) => setSelected(suppliers.find((x) => x.id === s.id) || null)} />
            <p className="mt-2 text-xs text-muted">Pins mark each supplier’s municipality, not an exact address.</p>
          </div>

          <div>
            <p className="text-[13px] text-muted mb-3" aria-live="polite">
              {loading ? 'Loading suppliers…' : `${filtered.length} ${filtered.length === 1 ? 'supplier' : 'suppliers'}`}
            </p>

            {loading ? (
              <ul className="space-y-3" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-36 rounded-2xl bg-surface border border-line" />
                ))}
              </ul>
            ) : loadError ? (
              <Notice tone="error">The supplier directory could not load. Refresh the page to try again.</Notice>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
                <p className="font-semibold text-ink">No suppliers match</p>
                <p className="mt-1 text-sm text-muted">Try another town or product, or clear the filters.</p>
                {(search || activeCategory !== 'all') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setSearch('');
                      setActiveCategory('all');
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <ul className="space-y-3">
                {filtered.map((s) => (
                  <li
                    key={s.id}
                    className={cx(
                      'bg-surface rounded-2xl border p-5 transition-colors',
                      selected?.id === s.id ? 'border-brand' : 'border-line'
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <h3 className="font-bold text-ink text-[17px] leading-snug">{s.name}</h3>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-good">
                        <BadgeCheck className="w-3.5 h-3.5" />
                        Reviewed {new Date(s.verifiedAt).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-muted capitalize">
                      {s.category.replace('-', ' ')} · {s.location}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink">{s.products}</p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => setIntroSupplier(s)}>
                        Request introduction
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => showOnMap(s)}>
                        <MapPin />
                        Show on map
                      </Button>
                      {s.publicPhone && (
                        <a href={`tel:${s.publicPhone}`} className="inline-flex items-center gap-1.5 h-8 px-2 text-[13px] font-medium text-brand hover:underline">
                          <Phone className="w-4 h-4" />
                          {s.publicPhone}
                        </a>
                      )}
                      {s.publicEmail && (
                        <a href={`mailto:${s.publicEmail}`} className="inline-flex items-center gap-1.5 h-8 px-2 text-[13px] font-medium text-brand hover:underline">
                          <Mail className="w-4 h-4" />
                          Email
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Apply for listing */}
      <Modal
        open={showApply}
        onClose={closeApply}
        size="lg"
        title="List your business"
        description="Enterseed publishes only businesses that opt in and pass staff review of identity, registration, contact details, and publication consent."
      >
        {applyStatus?.tone === 'success' ? (
          <div className="space-y-5">
            <Notice tone="success">{applyStatus.text}</Notice>
            <Button className="w-full" onClick={closeApply}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleApplySubmit} className="space-y-4">
            {applyStatus && <Notice tone="error">{applyStatus.text}</Notice>}
            <Field label="Business name">
              {(id) => (
                <input id={id} type="text" required value={applyForm.businessName} onChange={(e) => setApplyForm({ ...applyForm, businessName: e.target.value })} placeholder="e.g. South Cotabato Bio-Pack" className={inputClass} />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact person">
                {(id) => <input id={id} type="text" required value={applyForm.contactName} onChange={(e) => setApplyForm({ ...applyForm, contactName: e.target.value })} className={inputClass} />}
              </Field>
              <Field label="Email for verification" hint="Private. Only staff see this.">
                {(id) => <input id={id} type="email" required value={applyForm.contactEmail} onChange={(e) => setApplyForm({ ...applyForm, contactEmail: e.target.value })} className={inputClass} />}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                {(id) => (
                  <select id={id} value={applyForm.category} onChange={(e) => setApplyForm({ ...applyForm, category: e.target.value })} className={inputClass}>
                    {CATEGORIES.slice(1).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Municipality">
                {(id) => <input id={id} type="text" required value={applyForm.location} onChange={(e) => setApplyForm({ ...applyForm, location: e.target.value })} className={inputClass} />}
              </Field>
            </div>
            <Field label="Products and capabilities">
              {(id) => (
                <textarea id={id} rows={3} required value={applyForm.products} onChange={(e) => setApplyForm({ ...applyForm, products: e.target.value })} placeholder="Goods, packaging types, minimum orders, delivery areas" className={textareaClass} />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Public email" hint="Optional">
                {(id) => <input id={id} type="email" value={applyForm.publicEmail} onChange={(e) => setApplyForm({ ...applyForm, publicEmail: e.target.value })} placeholder="sales@example.ph" className={inputClass} />}
              </Field>
              <Field label="Public phone" hint="Optional">
                {(id) => <input id={id} type="tel" value={applyForm.publicPhone} onChange={(e) => setApplyForm({ ...applyForm, publicPhone: e.target.value })} placeholder="+63 917 000 0000" className={inputClass} />}
              </Field>
            </div>
            <CheckField checked={applyForm.consent} onChange={(consent) => setApplyForm({ ...applyForm, consent })}>
              Enterseed may verify these details and publish this listing in the South Cotabato MSME directory after review.
            </CheckField>
            <Button type="submit" size="lg" className="w-full" disabled={applySubmitting || !applyForm.consent}>
              {applySubmitting ? 'Sending…' : 'Submit for review'}
            </Button>
          </form>
        )}
      </Modal>

      {/* Introduction request */}
      <Modal
        open={!!introSupplier}
        onClose={closeIntro}
        title="Request an introduction"
        description={introSupplier ? `To ${introSupplier.name}, ${introSupplier.location}.` : undefined}
      >
        {introStatus?.tone === 'success' ? (
          <div className="space-y-5">
            <Notice tone="success">{introStatus.text}</Notice>
            <Button className="w-full" onClick={closeIntro}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleIntroSubmit} className="space-y-4">
            {introStatus && <Notice tone="error">{introStatus.text}</Notice>}
            <Field label="Your name">
              {(id) => <input id={id} type="text" required value={introForm.name} onChange={(e) => setIntroForm({ ...introForm, name: e.target.value })} className={inputClass} />}
            </Field>
            <Field label="Your email">
              {(id) => <input id={id} type="email" required value={introForm.email} onChange={(e) => setIntroForm({ ...introForm, email: e.target.value })} className={inputClass} />}
            </Field>
            <Field label="What do you need?">
              {(id) => (
                <textarea id={id} rows={4} required value={introForm.message} onChange={(e) => setIntroForm({ ...introForm, message: e.target.value })} placeholder="Volume, specifications, timing" className={textareaClass} />
              )}
            </Field>
            <CheckField checked={introForm.consent} onChange={(consent) => setIntroForm({ ...introForm, consent })}>
              Share my request with this supplier and Enterseed support staff.
            </CheckField>
            <Button type="submit" size="lg" className="w-full" disabled={introSubmitting || !introForm.consent}>
              {introSubmitting ? 'Sending…' : 'Send request'}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
};
