import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ChatComposer, ChatThread, useBossNarraChat } from '../components/BossNarraChat';
import { PageHeader, Button } from '../components/ui';
import { Download } from 'lucide-react';

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

  const handleExportTranscript = () => {
    const transcript = messages
      .map((m) => `[${m.role === 'user' ? 'You' : 'Boss Narra'}]\n${m.text}\n${m.sources?.map((s) => `  - Source: ${s.label} (${s.url})`).join('\n') || ''}\n`)
      .join('\n---\n\n');

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boss-narra-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view-enter max-w-4xl mx-auto flex flex-col gap-4 h-[calc(100dvh-8rem)] min-h-[540px]">
      <PageHeader
        title={t('chatbot.name')}
        lead="AI advisor for South Cotabato MSMEs. Provides general guidance on registrations, financing, and suppliers with official portal links."
        actions={
          messages.length > 1 ? (
            <Button variant="secondary" size="sm" onClick={handleExportTranscript}>
              <Download className="w-3.5 h-3.5 mr-1" />
              Export Transcript (.TXT)
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 min-h-0 bg-surface rounded-2xl border border-line flex flex-col overflow-hidden shadow-xs">
        <ChatThread
          messages={messages}
          loading={loading}
          after={
            isFresh && (
              <div className="pl-[38px] pt-1 pb-2">
                <p className="text-xs font-bold text-ink mb-2 uppercase tracking-wider">Suggested Questions</p>
                <ul className="flex flex-wrap gap-2">
                  {PROMPTS.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        onClick={() => send(prompt)}
                        className="text-left text-xs leading-snug text-brand bg-brand-soft hover:bg-purple-100 px-3 py-2 rounded-xl transition-colors font-medium border border-brand/20"
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
        <div className="px-4 py-2 border-t border-line/60 bg-sunken/40 text-[11px] text-muted text-center">
          Informational support only · Always verify requirements directly with DTI, DOST, LGU, or BIR.
        </div>
        <ChatComposer onSend={send} loading={loading} />
      </div>
    </div>
  );
};
