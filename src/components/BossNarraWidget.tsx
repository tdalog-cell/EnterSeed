import React, { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { BossNarraAvatar, ChatComposer, ChatThread, useBossNarraChat } from './BossNarraChat';

/** Floating quick-ask panel. Hidden on the full Boss Narra page, where the same chat is the page itself. */
export const BossNarraWidget: React.FC<{ hidden?: boolean }> = ({ hidden }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const { messages, loading, send } = useBossNarraChat();

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('open-boss-nana', open);
    return () => window.removeEventListener('open-boss-nana', open);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (hidden) return null;

  return (
    <div className="fixed right-4 bottom-20 md:right-6 md:bottom-6 z-50">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center gap-2 w-12 h-12 sm:w-auto sm:pl-4 sm:pr-5 rounded-full bg-brand text-white font-semibold text-sm shadow-[0_10px_30px_-10px_rgb(74_29_143/0.7)] hover:bg-brand-deep transition-colors"
          aria-label={t('chatbot.label')}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="hidden sm:inline">{t('chatbot.label')}</span>
        </button>
      ) : (
        <section
          aria-label="Boss Narra"
          className="pop-in w-[calc(100vw-2rem)] sm:w-[400px] h-[min(560px,calc(100vh-7rem))] bg-surface rounded-2xl border border-line shadow-[0_24px_60px_-20px_rgb(36_23_43/0.45)] flex flex-col overflow-hidden origin-bottom-right"
        >
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
            <div className="flex items-center gap-2.5">
              <BossNarraAvatar size="md" />
              <div>
                <h2 className="font-bold text-sm text-ink leading-tight">{t('chatbot.name')}</h2>
                <p className="text-xs text-muted">{t('chatbot.status')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-sunken"
              aria-label={t('chatbot.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          <ChatThread messages={messages} loading={loading} dense>
            <p className="text-xs leading-relaxed text-muted bg-sunken rounded-lg px-3 py-2">{t('chatbot.disclaimer')}</p>
          </ChatThread>
          <ChatComposer onSend={send} loading={loading} autoFocus />
        </section>
      )}
    </div>
  );
};
