import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../services/apiClient';
import { Button, Field, Notice, PageHeader, Panel, PanelHeader, cx, inputClass, textareaClass } from '../components/ui';
import { Share2, Copy, Check, Sparkles, Tag, FileSpreadsheet, RefreshCw, MessageSquare } from 'lucide-react';

const FacebookIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

export const MarketingView: React.FC = () => {
  const { user, isDemo } = useAuth();
  const { language } = useLanguage();

  const [toolType, setToolType] = useState<'facebook_post' | 'promo_text' | 'price_list'>('facebook_post');
  const [businessName, setBusinessName] = useState(user?.business || 'Matutum Highlands Coffee');
  const [productOrOffer, setProductOrOffer] = useState(isDemo ? 'Freshly Roasted Mt. Matutum Arabica & Robusta Coffee Beans' : '');
  const [targetAudience, setTargetAudience] = useState(isDemo ? 'Coffee lovers, local cafe owners, and families in South Cotabato' : '');
  const [tone, setTone] = useState<'friendly' | 'professional' | 'festive' | 'urgent'>('friendly');
  const [contentLanguage, setContentLanguage] = useState<'fil' | 'en' | 'ceb' | 'hil'>(language);
  const [keyDetails, setKeyDetails] = useState(isDemo ? '250g whole beans at ₱280, free delivery within Koronadal for orders above ₱500.' : '');

  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState(isDemo ? (
    `☕ Magandang araw mga suki at kapwa taga-South Cotabato!\n\nIpinagmamalaki ng Matutum Highlands Coffee ang aming: Freshly Roasted Mt. Matutum Arabica & Robusta Coffee Beans!\n\n✨ Bakit mo magugustuhan ito:\n• Sariwa at de-kalidad mula sa lokal na produksyon sa paanan ng Mt. Matutum\n• Abot-kayang presyo para sa inyong pamilya at negosyo (₱280 per 250g bag)\n• May libreng delivery sa Koronadal para sa orders mula ₱500 pataas\n\n📩 Mag-iwan ng mensahe (PM) o mag-comment sa ibaba para magpa-reserve o mag-order ngayon!\n\n#SouthCotabatoMSME #SupportLocal #MatutumHighlandsCoffee #GawangLokal`
  ) : '');
  const [copied, setCopied] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      if (data.copy) {
        setGeneratedText(data.copy);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Generation error. Please check your inputs and retry.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
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
        eyebrow="Make your next impression count"
        title="Good words. Better connections."
        lead="Generate customer-ready Facebook captions, promotional blasts, and price lists in Filipino, English, or Bisaya tailored for your local audience."
      />

      {errorNotice && <Notice tone="error">{errorNotice}</Notice>}

      {/* Mode Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-4">
        <Button
          variant={toolType === 'facebook_post' ? 'primary' : 'secondary'}
          size="md"
          onClick={() => setToolType('facebook_post')}
        >
          <FacebookIcon className="w-4 h-4 mr-1.5" />
          Facebook Post & Caption
        </Button>
        <Button
          variant={toolType === 'promo_text' ? 'primary' : 'secondary'}
          size="md"
          onClick={() => setToolType('promo_text')}
        >
          <Tag className="w-4 h-4 mr-1.5" />
          Promotional Text Blast
        </Button>
        <Button
          variant={toolType === 'price_list' ? 'primary' : 'secondary'}
          size="md"
          onClick={() => setToolType('price_list')}
        >
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />
          Catalog / Price List
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Inputs */}
        <div className="lg:col-span-5 bg-surface border border-line rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <h2 className="font-bold text-ink text-base">Content Generator Details</h2>
            <span className="text-xs text-muted">Plain Language</span>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4">
            <Field label="Business Name">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>

            <Field label="Product or Main Offer">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  required
                  value={productOrOffer}
                  onChange={(e) => setProductOrOffer(e.target.value)}
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
                    onChange={(e) => setContentLanguage(e.target.value as any)}
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
                    onChange={(e) => setTone(e.target.value as any)}
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

            <Field label="Target Audience / Municipality">
              {(id) => (
                <input
                  id={id}
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Koronadal coffee drinkers"
                  className={inputClass}
                />
              )}
            </Field>

            <Field label="Key Details (Prices, Promos, Pickup Locations)" hint="Add prices, delivery corridors, or special perks.">
              {(id) => (
                <textarea
                  id={id}
                  rows={3}
                  value={keyDetails}
                  onChange={(e) => setKeyDetails(e.target.value)}
                  placeholder="e.g. ₱280 per pack, GCash accepted, pick-up along GenSan Drive."
                  className={textareaClass}
                />
              )}
            </Field>

            <Button type="submit" variant="primary" disabled={generating} className="w-full">
              <Sparkles className="w-4 h-4 mr-1.5" />
              {generating ? 'Drafting Content…' : 'Generate Marketing Draft'}
            </Button>
          </form>
        </div>

        {/* Live Preview & Editable Editor */}
        <div className="lg:col-span-7 space-y-4">
          <Panel>
            <PanelHeader
              title="Your draft, your voice"
              description="Review and tweak the draft below. Click Copy to paste directly into Facebook or Messenger."
              action={
                <Button variant="secondary" size="sm" onClick={handleCopy} disabled={!generatedText.trim()}>
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-good mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy Text
                    </>
                  )}
                </Button>
              }
            />

            <div className="space-y-4 pt-2">
              <textarea
                aria-label="Your editable marketing draft"
                rows={11}
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                className={cx(
                  textareaClass,
                  'font-sans text-sm sm:text-base leading-relaxed bg-white border-line-strong p-4 focus:ring-2 focus:ring-brand'
                )}
              />

              <div className="flex flex-wrap items-center justify-between text-xs text-muted">
                <span>{generatedText.length} characters · {generatedText.split(/\s+/).filter(Boolean).length} words</span>
                <span className="text-brand font-medium">Review your draft before sharing</span>
              </div>
            </div>
          </Panel>

          {/* Social Post Simulation Card */}
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand text-white font-bold flex items-center justify-center text-sm">
                {businessName[0] || 'M'}
              </div>
              <div>
                <p className="font-bold text-ink text-sm leading-tight">{businessName}</p>
                <p className="text-[11px] text-muted">Just now · Koronadal City · 🌍</p>
              </div>
            </div>

            <div className="bg-sunken/40 rounded-xl p-3 border border-line/60">
              <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed">
                {generatedText.slice(0, 320)}
                {generatedText.length > 320 ? '… [See More]' : ''}
              </p>
            </div>

            <div className="pt-2 border-t border-line flex items-center justify-around text-xs font-semibold text-muted">
              <span>👍 Like</span>
              <span>💬 Comment</span>
              <span>↗️ Share</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
