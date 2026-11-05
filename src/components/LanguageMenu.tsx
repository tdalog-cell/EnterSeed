import React, { useCallback, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useLanguage, ENABLED_LANGUAGES as LANGUAGES } from '../context/LanguageContext';
import { cx, useDismiss } from './ui';

export const LanguageMenu: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss(open, close);

  if (LANGUAGES.length < 2) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language: ${LANGUAGES.find((l) => l.code === language)?.label}`}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[13px] font-semibold text-ink hover:bg-brand-soft transition-colors"
      >
        <Globe className="w-4 h-4 text-muted" />
        <span className="uppercase">{language}</span>
        <ChevronDown className={cx('w-3.5 h-3.5 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div role="menu" className="pop-in absolute right-0 mt-1.5 w-44 bg-surface rounded-xl border border-line shadow-[0_12px_32px_-12px_rgb(43_28_51/0.35)] p-1 z-50">
          {LANGUAGES.map((l) => {
            const active = language === l.code;
            return (
              <button
                key={l.code}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setLanguage(l.code);
                  close();
                }}
                className={cx(
                  'w-full flex items-center justify-between h-9 px-3 rounded-lg text-sm text-left',
                  active ? 'font-semibold text-brand bg-brand-soft' : 'text-ink hover:bg-sunken'
                )}
              >
                <span>{l.label}</span>
                {active && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
