import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../services/apiClient';
import { useUnsavedChanges } from '../utils/useUnsavedChanges';
import { Button, Field, Notice, PageHeader, Panel, PanelHeader, cx, inputClass, textareaClass } from '../components/ui';
import { Copy, Check, Sparkles, Tag, FileSpreadsheet } from 'lucide-react';

const FacebookIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const MarketingView: React.FC = () => {
  const { user, isDemo } = useAuth();
  const { language } = useLanguage();

  type ToolType = 'facebook_post' | 'promo_text' | 'price_list';
  type Draft = { toolType: ToolType; businessName: string; productOrOffer: string; targetAudience: string; tone: 'friendly' | 'professional' | 'festive' | 'urgent'; contentLanguage: 'fil' | 'en' | 'ceb' | 'hil'; keyDetails: string; outputs: Record<ToolType, string>; edited: Partial<Record<ToolType, boolean>> };
  const storageKey = `enterseed_marketing_draft:${isDemo ? 'demo' : 'account'}:${user?.email || 'guest'}`;
  const [draft, setDraft] = useState<Draft>(() => {
    const initial: Draft = { toolType: 'facebook_post', businessName: user?.business || '', productOrOffer: isDemo ? 'Freshly roasted coffee beans' : '', targetAudience: isDemo ? 'Coffee lovers in South Cotabato' : '', tone: 'friendly', contentLanguage: language, keyDetails: isDemo ? '250g for ₱280. Pickup in Koronadal.' : '', outputs: { facebook_post: '', promo_text: '', price_list: '' }, edited: {} };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && ['facebook_post', 'promo_text', 'price_list'].includes(saved.toolType) && ['businessName', 'productOrOffer', 'targetAudience', 'keyDetails'].every(key => typeof saved[key] === 'string') && ['friendly', 'professional', 'festive', 'urgent'].includes(saved.tone) && ['fil', 'en', 'ceb', 'hil'].includes(saved.contentLanguage) && ['facebook_post', 'promo_text', 'price_list'].every(key => typeof saved.outputs?.[key] === 'string')) return { ...initial, ...saved, edited: saved.edited || {} };
    } catch { /* A new draft is available when browser storage cannot be read. */ }
    return initial;
  });
  const { toolType, businessName, productOrOffer, targetAudience, tone, contentLanguage, keyDetails } = draft;
  const generatedText = draft.outputs[toolType];
  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const setToolType = (value: ToolType) => { setField('toolType', value); setErrorNotice(null); setGenerated(false); };
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [generated, setGenerated] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [draft, storageKey]);
  useEffect(() => { setCopied(false); }, [generatedText, toolType]);
  useUnsavedChanges(generating || (storageError && Boolean(generatedText.trim() || productOrOffer.trim())));

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (generating) return;
    if (draft.edited[toolType] && !window.confirm('Replace your edited draft? Copy any text you want to keep before continuing.')) return;
    setGenerating(true);
    setErrorNotice(null);

    try {
      const res = await apiFetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: toolType,
          businessName: businessName.trim(),
          productOrOffer: productOrOffer.trim(),
          targetAudience: targetAudience.trim(),
          tone,
          language: contentLanguage,
          keyDetails: keyDetails.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate marketing content.');
      if (typeof data.copy !== 'string' || !data.copy.trim()) throw new Error('No draft was returned. Your previous text is still here. Please try again.');
      setDraft(previous => ({ ...previous, outputs: { ...previous.outputs, [toolType]: data.copy }, edited: { ...previous.edited, [toolType]: false } }));
      setGenerated(true);
      requestAnimationFrame(() => {
        const preview = document.getElementById('marketing-preview');
        preview?.focus({ preventScroll: true });
        preview?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      });
    } catch (err: any) {
      setErrorNotice(err.message || 'Generation error. Please check your inputs and retry.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      setErrorNotice(null);
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setErrorNotice('Clipboard access is unavailable. Select the draft text and copy it manually.');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Marketing drafts"
        lead="Choose a format, add your offer, and create text you can edit and copy. Nothing is posted automatically."
      />

      {errorNotice && <Notice tone="error">{errorNotice}</Notice>}

      <div role="group" aria-label="Marketing format" className="grid sm:grid-cols-3 gap-3">
        {([
          { value: 'facebook_post', title: 'Facebook post', detail: 'A caption for your business page.', icon: FacebookIcon },
          { value: 'promo_text', title: 'Promotional message', detail: 'A short offer for SMS or Messenger.', icon: Tag },
          { value: 'price_list', title: 'Price list', detail: 'An easy-to-read list of products and prices.', icon: FileSpreadsheet }
        ] as const).map(({ value, title, detail, icon: Icon }) => <button type="button" key={value} disabled={generating} aria-pressed={toolType === value} onClick={() => setToolType(value)} className={cx('flex items-start gap-3 p-4 text-left rounded-xl border transition-colors', toolType === value ? 'bg-brand-soft border-brand' : 'bg-surface border-line hover:bg-sunken')}><Icon className="w-5 h-5 text-brand shrink-0 mt-0.5" /><span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted mt-1">{detail}</span></span></button>)}
      </div>
      {storageError ? <Notice tone="error">This browser could not save your draft. Copy your text before leaving this page.</Notice> : <p className="text-xs text-muted" role="status">Your inputs and each format’s draft are saved automatically in this browser.</p>}
      {generated && <Notice tone="success">Draft created. Review the text, then select Copy text when you’re ready to use it.</Notice>}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Inputs */}
        <div className="lg:col-span-5 bg-surface border border-line rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <h2 className="font-bold text-ink text-base">Your offer</h2>
            <span className="text-xs text-muted">All formats use these details</span>
          </div>

          <form onSubmit={handleGenerate}><fieldset disabled={generating} className="space-y-4">
            <Field label="Business name">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setField('businessName', e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>

            <Field label="Product or offer">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={productOrOffer}
                  onChange={(e) => setField('productOrOffer', e.target.value)}
                  placeholder="e.g. Arabica Dark Roast or Buko Pie 3-Pack"
                  className={inputClass}
                />
              )}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Language">
                {(id) => (
                  <select
                    id={id}
                    value={contentLanguage}
                    onChange={(e) => setField('contentLanguage', e.target.value as Draft['contentLanguage'])}
                    className={inputClass}
                  >
                    <option value="fil">Filipino (Tagalog)</option>
                    <option value="ceb">Bisaya (Cebuano)</option>
                    <option value="hil">Hiligaynon</option>
                    <option value="en">English</option>
                  </select>
                )}
              </Field>

              <Field label="Tone">
                {(id) => (
                  <select
                    id={id}
                    value={tone}
                    onChange={(e) => setField('tone', e.target.value as Draft['tone'])}
                    className={inputClass}
                  >
                    <option value="friendly">Friendly & Warm</option>
                    <option value="professional">Professional</option>
                    <option value="festive">Holiday / Fiesta</option>
                    <option value="urgent">Limited Time</option>
                  </select>
                )}
              </Field>
            </div>

            <Field label="Customers or location">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setField('targetAudience', e.target.value)}
                  placeholder="e.g. Koronadal coffee drinkers"
                  className={inputClass}
                />
              )}
            </Field>

            <Field label="Prices, pickup, and delivery" hint="Include only details you want in the draft.">
              {(id) => (
                <textarea
                  id={id}
                  rows={3}
                  value={keyDetails}
                  onChange={(e) => setField('keyDetails', e.target.value)}
                  placeholder="e.g. ₱280 per pack, GCash accepted, pick-up along GenSan Drive."
                  className={textareaClass}
                />
              )}
            </Field>

            <Button type="submit" variant="primary" disabled={generating} className="w-full">
              <Sparkles className="w-4 h-4 mr-1.5" />
              {generating ? 'Creating draft…' : 'Create draft'}
            </Button>
          </fieldset></form>
        </div>

        {/* Live Preview & Editable Editor */}
        <div id="marketing-preview" role="region" aria-label="Marketing draft preview" tabIndex={-1} className="lg:col-span-7 space-y-4 scroll-mt-24 outline-none">
          <Panel>
            <PanelHeader
              title="Review your draft"
              description="Review and tweak the draft below. Click Copy to paste directly into Facebook or Messenger."
              action={
                <Button variant="secondary" size="sm" onClick={handleCopy} disabled={!generatedText.trim()}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-good mr-1" />
                      Text copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy text
                    </>
                  )}
                </Button>
              }
            />

            <div className="space-y-4 pt-2">
              <textarea
                aria-label="Your editable marketing draft"
                placeholder="Your draft will appear here. Add your offer and select Create draft."
                disabled={generating}
                rows={11}
                value={generatedText}
                onChange={(e) => setDraft(previous => ({ ...previous, outputs: { ...previous.outputs, [toolType]: e.target.value }, edited: { ...previous.edited, [toolType]: true } }))}
                className={cx(
                  textareaClass,
                  'font-sans text-sm sm:text-base leading-relaxed bg-surface border-line-strong p-4 focus:ring-2 focus:ring-brand'
                )}
              />

              <div className="flex flex-wrap gap-2 items-center justify-between text-xs text-muted">
                <span>{generatedText.length} characters · {generatedText.split(/\s+/).filter(Boolean).length} words</span>
                <span className="text-brand font-medium">Review your draft before sharing</span>
              </div>
            </div>
          </Panel>


        </div>
      </div>
    </div>
  );
};
