import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ENABLED_LANGUAGES, Language } from '../context/LanguageContext';

/** Per-language greeting so each option reads in its own language. */
const PROMPT_COPY: Record<Language, { greeting: string; action: string }> = {
  en: { greeting: 'Welcome', action: 'Continue in English' },
  fil: { greeting: 'Mabuhay', action: 'Magpatuloy sa Filipino' },
  ceb: { greeting: 'Malipayong pag-abot', action: 'Padayon sa Bisaya' },
  hil: { greeting: 'Maayong pag-abot', action: 'Padayon sa Hiligaynon' }
};

/** Large, tappable language options. The list grows automatically when a language is enabled. */
export const LanguageChoice: React.FC<{ onChoose: (lang: Language) => void; current?: Language }> = ({
  onChoose,
  current
}) => (
  <ul className="grid gap-3">
    {ENABLED_LANGUAGES.map((l) => {
      const copy = PROMPT_COPY[l.code];
      const active = current === l.code;
      return (
        <li key={l.code}>
          <button
            type="button"
            lang={l.code}
            onClick={() => onChoose(l.code)}
            className={`group w-full flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left transition-colors ${
              active ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface hover:border-brand hover:bg-brand-soft/60'
            }`}
          >
            <span>
              <span className="block text-xl font-bold text-ink">{copy.greeting}</span>
              <span className="block text-sm text-muted">{copy.action}</span>
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-brand">
              {l.label}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);
