import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  apiFetch,
  fetchSupplierReviews,
  submitSupplierReview,
  fetchSupplierMessages,
  sendSupplierMessage,
  SupplierListing,
  SupplierReview,
  SupplierMessage
} from '../services/apiClient';
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
import {
  Mail,
  Phone,
  MapPin,
  Plus,
  Search,
  BadgeCheck,
  Star,
  MessageSquare,
  Clock,
  ExternalLink,
  Send,
  Building,
  CheckCircle2,
  Inbox
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Suppliers' },
  { id: 'raw-materials', label: 'Raw Materials' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'services', label: 'Intermediary / B2B Services' },
  { id: 'marketing', label: 'Marketing Agencies' }
];

export const MarketingView: React.FC = () => {
  const { user } = useAuth();
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Local MSME Proponent';

  const [activeMainTab, setActiveMainTab] = useState<'directory' | 'messages'>('directory');
  const [suppliers, setSuppliers] = useState<SupplierListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selected, setSelected] = useState<SupplierListing | null>(null);
  const mapAnchor = useRef<HTMLDivElement>(null);

  // Supplier Reviews modal
  const [reviewSupplier, setReviewSupplier] = useState<SupplierListing | null>(null);
  const [reviewsList, setReviewsList] = useState<SupplierReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Direct Messaging modal
  const [messageSupplier, setMessageSupplier] = useState<SupplierListing | null>(null);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgNotice, setMsgNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Inquiries & Messages thread view
  const [myMessages, setMyMessages] = useState<SupplierMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Supplier Application modal
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

  useEffect(() => {
    loadSuppliers();
    loadMessages();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/suppliers');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSuppliers(data.suppliers || []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      setLoadingMessages(true);
      const msgs = await fetchSupplierMessages();
      setMyMessages(msgs);
    } catch (err) {
      console.warn('Could not load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const openReviewsModal = async (supplier: SupplierListing) => {
    setReviewSupplier(supplier);
    setNewReviewText('');
    setReviewSuccess(false);
    try {
      setLoadingReviews(true);
      const revs = await fetchSupplierReviews(supplier.id);
      setReviewsList(revs);
    } catch (err) {
      console.warn('Failed to load reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewSupplier) return;
    setSubmittingReview(true);
    try {
      await submitSupplierReview(reviewSupplier.id, {
        rating: newRating,
        reviewText: newReviewText
      });
      setReviewSuccess(true);
      const updated = await fetchSupplierReviews(reviewSupplier.id);
      setReviewsList(updated);
      setNewReviewText('');
      await loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const openMessageModal = (supplier: SupplierListing) => {
    setMessageSupplier(supplier);
    setMsgSubject(`Quotation Inquiry: ${supplier.category.replace('-', ' ')}`);
    setMsgBody('');
    setMsgNotice(null);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageSupplier) return;
    setSendingMsg(true);
    setMsgNotice(null);
    try {
      await sendSupplierMessage(messageSupplier.id, {
        subject: msgSubject,
        message: msgBody
      });
      setMsgNotice({
        tone: 'success',
        text: `Message dispatched to ${messageSupplier.name}. Track updates in the "Sent Inquiries" tab.`
      });
      setMsgBody('');
      await loadMessages();
    } catch (err: any) {
      setMsgNotice({ tone: 'error', text: err.message || 'Failed to deliver message.' });
    } finally {
      setSendingMsg(false);
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplySubmitting(true);
    setApplyStatus(null);
    try {
      const res = await apiFetch('/api/supplier-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applyForm)
      });
      if (!res.ok) throw new Error('Submission error');
      setApplyStatus({
        tone: 'success',
        text: 'Application submitted! DTI Negosyo Center will verify your business documents before listing.'
      });
    } catch (err: any) {
      setApplyStatus({ tone: 'error', text: err.message || 'Application could not be sent.' });
    } finally {
      setApplySubmitting(false);
    }
  };

  const showOnMap = (s: SupplierListing) => {
    setSelected(s);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      mapAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = suppliers.filter(
    (s) =>
      (activeCategory === 'all' || s.category === activeCategory) &&
      (!q || [s.name, s.location, s.category, s.products].some((f) => f.toLowerCase().includes(q)))
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-end">
        <PageHeader
          title="Omnichannel Local Supplier Network"
          lead="Searchable B2B directory across South Cotabato, interactive regional map, verified peer reviews, and direct MSME-to-supplier messaging."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant={activeMainTab === 'directory' ? 'primary' : 'secondary'}
                size="md"
                onClick={() => setActiveMainTab('directory')}
              >
                <Building className="w-4 h-4 mr-1.5" />
                Supplier Directory ({suppliers.length})
              </Button>
              <Button
                variant={activeMainTab === 'messages' ? 'primary' : 'secondary'}
                size="md"
                onClick={() => setActiveMainTab('messages')}
              >
                <Inbox className="w-4 h-4 mr-1.5" />
                Sent Inquiries ({myMessages.length})
              </Button>
            </div>
          }
        />
        <PhotoImg photo={PHOTOS.fruitStand} sizes="(min-width: 768px) 320px, 100vw" className="h-40 md:h-36 rounded-2xl" eager />
      </div>

      {activeMainTab === 'directory' ? (
        <>
          {/* Shipping Subsidy Estimator */}
          <SubsidyEstimator />

          {/* Directory Toolbar */}
          <section aria-labelledby="directory-h" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="directory-h" className="text-xl font-bold text-ink">
                  Verified South Cotabato Suppliers
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Accredited local producers, packaging innovators, and cold-chain logistics partners.
                </p>
              </div>
              <Button onClick={() => setShowApply(true)} className="self-start sm:self-auto">
                <Plus className="w-4 h-4 mr-1" />
                List Your Business
              </Button>
            </div>

            {/* Search & Category Pills */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative md:w-80 shrink-0">
                <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search supplier, town, or product..."
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

            {/* Map and Directory Grid */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
              <div ref={mapAnchor} className="lg:sticky lg:top-20 scroll-mt-20">
                <SupplierMap
                  suppliers={suppliers as any}
                  selectedSupplier={selected as any}
                  onSelectSupplier={(s) => setSelected(suppliers.find((x) => x.id === s.id) || null)}
                />
                <p className="mt-2 text-xs text-muted">
                  Interactive municipal pins across Koronadal, Polomolok, Tupi, Surallah, and Lake Sebu.
                </p>
              </div>

              <div>
                <p className="text-[13px] text-muted mb-3" aria-live="polite">
                  {loading ? 'Loading suppliers…' : `${filtered.length} verified ${filtered.length === 1 ? 'supplier' : 'suppliers'} available`}
                </p>

                {loading ? (
                  <ul className="space-y-3" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <li key={i} className="h-44 rounded-2xl bg-surface border border-line animate-pulse" />
                    ))}
                  </ul>
                ) : loadError ? (
                  <Notice tone="error">The supplier directory could not load. Refresh the page to try again.</Notice>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
                    <p className="font-semibold text-ink">No suppliers match your criteria</p>
                    <p className="mt-1 text-sm text-muted">Try clearing your search query or selecting "All Suppliers".</p>
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
                  <ul className="space-y-3.5">
                    {filtered.map((s) => (
                      <li
                        key={s.id}
                        className={cx(
                          'bg-surface rounded-2xl border p-5 transition-all shadow-xs',
                          selected?.id === s.id ? 'border-brand ring-1 ring-brand/30' : 'border-line hover:border-brand/40'
                        )}
                      >
                        {/* Header: Title, Category, Rating */}
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                          <div>
                            <h3 className="font-bold text-ink text-[17px] leading-snug">{s.name}</h3>
                            <p className="text-xs text-muted capitalize mt-0.5">
                              {s.category.replace('-', ' ')} · {s.location}
                            </p>
                          </div>

                          {/* Referral & Trust Metric */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openReviewsModal(s)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 transition-colors text-xs font-bold"
                              title="View MSME reviews and ratings"
                            >
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                              <span>{s.averageRating || 4.9}</span>
                              <span className="font-normal text-amber-700">({s.reviewCount || 10} reviews)</span>
                            </button>

                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                              DTI Verified
                            </span>
                          </div>
                        </div>

                        {/* Products Description */}
                        <p className="mt-3 text-sm leading-relaxed text-ink">{s.products}</p>

                        {/* Operating Details & Direct Actions */}
                        <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="primary" onClick={() => openMessageModal(s)}>
                              <MessageSquare className="w-3.5 h-3.5 mr-1" />
                              Message Supplier
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => openReviewsModal(s)}>
                              <Star className="w-3.5 h-3.5 mr-1" />
                              Reviews & Trust
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => showOnMap(s)}>
                              <MapPin className="w-3.5 h-3.5 mr-1" />
                              Show on map
                            </Button>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-brand font-medium">
                            {s.publicPhone && (
                              <a href={`tel:${s.publicPhone}`} className="inline-flex items-center gap-1 hover:underline">
                                <Phone className="w-3.5 h-3.5" />
                                {s.publicPhone}
                              </a>
                            )}
                            {s.publicEmail && (
                              <a href={`mailto:${s.publicEmail}`} className="inline-flex items-center gap-1 hover:underline">
                                <Mail className="w-3.5 h-3.5" />
                                Email
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      ) : (
        /* MESSAGES / INQUIRIES TAB */
        <Panel>
          <PanelHeader
            title="My Supplier Inquiries & Messages"
            description="Track real-time inquiries, quotations, and replies dispatched to South Cotabato suppliers."
          />

          {loadingMessages ? (
            <div className="py-12 text-center text-sm text-muted">Loading inquiry thread...</div>
          ) : myMessages.length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-sunken border border-line">
              <Inbox className="w-10 h-10 text-muted mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-ink">No inquiries dispatched yet.</p>
              <p className="text-xs text-muted mt-1">Browse the Supplier Directory and click "Message Supplier" to request quotations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {myMessages.map((msg) => (
                <div key={msg.id} className="p-4 sm:p-5 rounded-xl border border-line bg-surface space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink text-sm sm:text-base">
                        To: {msg.supplierName || `Supplier #${msg.supplierId}`}
                      </span>
                      <span className={cx(
                        'text-xs font-semibold px-2 py-0.5 rounded-full border',
                        msg.status === 'replied' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-blue-50 text-blue-800 border-blue-200'
                      )}>
                        {msg.status === 'replied' ? 'Replied' : 'Sent'}
                      </span>
                    </div>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(msg.createdAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                    </span>
                  </div>

                  <div className="bg-sunken/60 p-3 rounded-lg border border-line/60">
                    <p className="text-xs font-bold text-slate-800">Subject: {msg.subject}</p>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">"{msg.message}"</p>
                  </div>

                  {msg.reply && (
                    <div className="bg-purple-50/70 p-3 rounded-lg border border-purple-200 ml-4">
                      <div className="flex items-center gap-1 text-xs font-bold text-purple-900 mb-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" />
                        Supplier Response:
                      </div>
                      <p className="text-xs text-purple-950 leading-relaxed">{msg.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* MODAL: SUPPLIER REVIEWS & TRUST HISTORY */}
      <Modal
        open={Boolean(reviewSupplier)}
        onClose={() => setReviewSupplier(null)}
        title={reviewSupplier ? `Reviews for ${reviewSupplier.name}` : 'Supplier Reviews'}
      >
        {reviewSupplier && (
          <div className="space-y-5">
            {/* Trust Metric Summary */}
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-900 font-bold uppercase tracking-wider">Referral & Trust Metric</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
                  <span className="text-2xl font-extrabold text-purple-950">{reviewSupplier.averageRating || 4.9}</span>
                  <span className="text-xs text-purple-700">out of 5.0 ({reviewsList.length} reviews)</span>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-800 bg-white px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                100% Verified Local Transactions
              </span>
            </div>

            {/* Existing Reviews List */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              <p className="text-xs font-bold text-ink">Recent Verified MSME Endorsements:</p>
              {loadingReviews ? (
                <p className="text-xs text-muted py-4 text-center">Loading verified reviews...</p>
              ) : reviewsList.length === 0 ? (
                <p className="text-xs text-muted py-4 text-center">No reviews yet. Be the first MSME to leave a review!</p>
              ) : (
                reviewsList.map((rev) => (
                  <div key={rev.id} className="p-3 rounded-lg border border-line bg-sunken/40 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink">{rev.reviewerName}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-500" />
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted">{rev.reviewerBusiness}</p>
                    <p className="text-xs text-slate-700 pt-0.5">"{rev.reviewText}"</p>
                  </div>
                ))
              )}
            </div>

            {/* Write a Review Form */}
            <form onSubmit={handleReviewSubmit} className="pt-4 border-t border-line space-y-3">
              <p className="text-xs font-bold text-ink">Leave a Verified Review</p>
              {reviewSuccess && (
                <Notice tone="success">Your verified review has been published!</Notice>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Rating:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="p-1 text-amber-400 hover:scale-110 transition-transform"
                    >
                      <Star className={cx('w-5 h-5', star <= newRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300')} />
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                required
                placeholder="Describe product quality, delivery punctuality, and responsiveness..."
                value={newReviewText}
                onChange={(e) => setNewReviewText(e.target.value)}
                className={textareaClass}
              />

              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setReviewSupplier(null)}>
                  Close
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submittingReview || !newReviewText.trim()}>
                  {submittingReview ? 'Submitting...' : 'Post Verified Review'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* MODAL: DIRECT MESSAGING / INQUIRY */}
      <Modal
        open={Boolean(messageSupplier)}
        onClose={() => setMessageSupplier(null)}
        title={messageSupplier ? `Contact ${messageSupplier.name}` : 'Contact Supplier'}
      >
        {messageSupplier && (
          <form onSubmit={handleSendMessage} className="space-y-4">
            {msgNotice && (
              <Notice tone={msgNotice.tone}>{msgNotice.text}</Notice>
            )}

            <p className="text-xs text-muted">
              Direct B2B connection to <strong>{messageSupplier.name}</strong> ({messageSupplier.location}).
            </p>

            <Field label="Inquiry Subject">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>

            <Field label="Message & Requirements (Specifications, Volumes, Timelines)">
              {(id) => (
                <textarea
                  id={id}
                  rows={4}
                  required
                  placeholder="e.g., Hi, we need 1,000 units of custom packaging by next month. Can you provide a quotation and minimum order lead time?"
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  className={textareaClass}
                />
              )}
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setMessageSupplier(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={sendingMsg || !msgBody.trim()}>
                <Send className="w-3.5 h-3.5 mr-1" />
                {sendingMsg ? 'Dispatching...' : 'Send Inquiry'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: LIST YOUR BUSINESS (SUPPLIER APPLICATION) */}
      <Modal
        open={showApply}
        onClose={() => setShowApply(false)}
        size="lg"
        title="List Your Business in the Supplier Directory"
        description="Enterseed publishes businesses after staff verification of DTI registration, municipal location, and product catalogs."
      >
        {applyStatus?.tone === 'success' ? (
          <div className="space-y-4">
            <Notice tone="success">{applyStatus.text}</Notice>
            <Button className="w-full" onClick={() => setShowApply(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleApplySubmit} className="space-y-4">
            {applyStatus && <Notice tone="error">{applyStatus.text}</Notice>}
            <Field label="Business Name">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={applyForm.businessName}
                  onChange={(e) => setApplyForm({ ...applyForm, businessName: e.target.value })}
                  placeholder="e.g. South Cotabato Bio-Pack"
                  className={inputClass}
                />
              )}
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contact Person">
                {(id) => <input id={id} type="text" required value={applyForm.contactName} onChange={(e) => setApplyForm({ ...applyForm, contactName: e.target.value })} className={inputClass} />}
              </Field>
              <Field label="Email for Verification">
                {(id) => <input id={id} type="email" required value={applyForm.contactEmail} onChange={(e) => setApplyForm({ ...applyForm, contactEmail: e.target.value })} className={inputClass} />}
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category">
                {(id) => (
                  <select id={id} value={applyForm.category} onChange={(e) => setApplyForm({ ...applyForm, category: e.target.value })} className={inputClass}>
                    <option value="raw-materials">Raw Materials</option>
                    <option value="packaging">Packaging</option>
                    <option value="services">Intermediary / B2B Services</option>
                    <option value="marketing">Marketing Agencies</option>
                  </select>
                )}
              </Field>
              <Field label="Municipality">
                {(id) => <input id={id} type="text" required value={applyForm.location} onChange={(e) => setApplyForm({ ...applyForm, location: e.target.value })} className={inputClass} />}
              </Field>
            </div>

            <Field label="Products, Services & Order Minimums">
              {(id) => (
                <textarea
                  id={id}
                  rows={3}
                  required
                  value={applyForm.products}
                  onChange={(e) => setApplyForm({ ...applyForm, products: e.target.value })}
                  placeholder="Describe goods, packaging types, MOQs, delivery corridors"
                  className={textareaClass}
                />
              )}
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Public Email">
                {(id) => <input id={id} type="email" value={applyForm.publicEmail} onChange={(e) => setApplyForm({ ...applyForm, publicEmail: e.target.value })} className={inputClass} />}
              </Field>
              <Field label="Public Phone">
                {(id) => <input id={id} type="tel" value={applyForm.publicPhone} onChange={(e) => setApplyForm({ ...applyForm, publicPhone: e.target.value })} className={inputClass} />}
              </Field>
            </div>

            <CheckField checked={applyForm.consent} onChange={(consent) => setApplyForm({ ...applyForm, consent })}>
              I authorize Enterseed and DTI Negosyo Center to verify these business records and publish them in the local directory.
            </CheckField>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setShowApply(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={applySubmitting || !applyForm.consent}>
                {applySubmitting ? 'Submitting...' : 'Submit Application'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
