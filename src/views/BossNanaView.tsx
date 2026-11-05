import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ChatComposer, ChatThread, useBossNarraChat } from '../components/BossNarraChat';
import { PageHeader } from '../components/ui';

const PROMPTS = [
  'How do I register a business name with DTI BNRS?',
  'What do I need for a Mayor’s permit in Koronadal?',
  'How much cash buffer should an MSME keep?',
  'Where can I apply for DOST SETUP in South Cotabato?',
  'Paano magparehistro ng sole proprietorship sa BIR Form 1901?'
];

export const BossNanaView: React.FC = () => {
  const { t } = useLanguage();
  const { messages, loading, send, isFresh } = useBossNarraChat();

  return (
    <div className="view-enter max-w-3xl mx-auto flex flex-col gap-6 h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-8.5rem)] min-h-[520px]">
      <PageHeader title={t('chatbot.name')} lead={t('bossNana.heroLead')} />

      <div className="flex-1 min-h-0 bg-surface rounded-2xl border border-line flex flex-col overflow-hidden">
        <ChatThread
          messages={messages}
          loading={loading}
          after={
            isFresh && (
            <div className="pl-[38px]">
              <p className="text-[13px] font-semibold text-ink mb-2">Try asking</p>
              <ul className="flex flex-wrap gap-2">
                {PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      onClick={() => send(prompt)}
                      className="text-left text-[13px] leading-snug text-brand bg-brand-soft hover:bg-[#E6DAF3] px-3 py-2 rounded-xl transition-colors"
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            )
          }
        />
        <p className="px-5 pt-2 pb-0 text-xs text-muted bg-surface">{t('chatbot.disclaimer')}</p>
        <ChatComposer onSend={send} loading={loading} />
      </div>
    </div>
  );
};
