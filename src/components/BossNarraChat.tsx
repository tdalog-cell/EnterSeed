import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/apiClient';
import { cx } from './ui';

export interface ChatSource {
  label: string;
  url: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: ChatSource[];
}

const WELCOME_SOURCES: ChatSource[] = [
  { label: 'DTI BNRS', url: 'https://bnrs.dti.gov.ph/' },
  { label: 'BIR', url: 'https://www.bir.gov.ph/' },
  { label: 'DOST', url: 'https://www.dost.gov.ph/' }
];

const FALLBACK_SOURCES: ChatSource[] = [
  { label: 'DTI BNRS', url: 'https://bnrs.dti.gov.ph/' },
  { label: 'BIR', url: 'https://www.bir.gov.ph/' }
];

/** One conversation with Boss Narra: message list, send, and pending state. */
export function useBossNarraChat() {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { role: 'model', text: t('chatbot.welcome'), sources: WELCOME_SOURCES }
  ]);

  const send = async (raw: string) => {
    const question = raw.trim();
    if (!question || loading) return;

    const history = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await apiFetch(token ? '/api/boss-nana' : '/api/assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify({ question, history, language })
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: data.answer || 'I could not verify an answer from the current references.',
          sources: data.sources || []
        }
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'model', text: t('chatbot.unavailable'), sources: FALLBACK_SOURCES }]);
    } finally {
      setLoading(false);
    }
  };

  return { messages, loading, send, isFresh: messages.length === 1 };
}

export const BossNarraAvatar: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <span
    aria-hidden="true"
    className={cx(
      'shrink-0 rounded-full bg-brand text-white font-bold flex items-center justify-center',
      size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-xs'
    )}
  >
    BN
  </span>
);

export const ChatThread: React.FC<{
  messages: ChatMessage[];
  loading: boolean;
  dense?: boolean;
  children?: React.ReactNode;
  after?: React.ReactNode;
}> = ({ messages, loading, dense, children, after }) => {
  const { t } = useLanguage();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  return (
    <div className={cx('flex-1 overflow-y-auto', dense ? 'p-4 space-y-4' : 'p-5 sm:p-6 space-y-5')} aria-live="polite">
      {children}
      {messages.map((msg, idx) =>
        msg.role === 'user' ? (
          <div key={idx} className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand text-white px-4 py-2.5 text-sm leading-relaxed">
              {msg.text}
            </p>
          </div>
        ) : (
          <div key={idx} className="flex gap-2.5">
            <BossNarraAvatar />
            <div className="max-w-[88%] min-w-0">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink pt-1">{msg.text}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2.5">
                  <span className="sr-only">{t('chatbot.sources')}:</span>
                  <ul className="flex flex-wrap gap-1.5">
                    {msg.sources.map((src) => (
                      <li key={src.url + src.label}>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-line-strong text-xs font-medium text-brand hover:bg-brand-soft transition-colors"
                        >
                          {src.label}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )
      )}

      {loading && (
        <div className="flex gap-2.5 items-center">
          <BossNarraAvatar />
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-brand" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-brand [animation-delay:0.15s]" />
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-brand [animation-delay:0.3s]" />
          </span>
          <span className="text-[13px] text-muted">{t('chatbot.waiting')}</span>
        </div>
      )}
      {after}
      <div ref={endRef} />
    </div>
  );
};

export const ChatComposer: React.FC<{
  onSend: (text: string) => void;
  loading: boolean;
  autoFocus?: boolean;
}> = ({ onSend, loading, autoFocus }) => {
  const { t } = useLanguage();
  const [input, setInput] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;
        onSend(input);
        setInput('');
      }}
      className="border-t border-line p-3 bg-surface"
    >
      <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface pl-3.5 pr-1.5 focus-within:border-brand transition-colors">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('chatbot.placeholder')}
          aria-label={t('chatbot.placeholder')}
          maxLength={1200}
          autoFocus={autoFocus}
          className="flex-1 min-w-0 h-11 bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          aria-label={t('chatbot.send')}
          className="w-8 h-8 shrink-0 rounded-lg bg-brand text-white flex items-center justify-center hover:bg-brand-deep disabled:bg-line-strong transition-colors"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
};
