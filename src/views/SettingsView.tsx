import React from 'react';
import { Sun, Moon, Monitor, Check } from '../components/icons';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { PageHeader, Panel, PanelHeader, cx } from '../components/ui';
import { LanguageMenu } from '../components/LanguageMenu';

const THEMES: { value: ThemePreference; title: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', title: 'Light', description: 'A bright, clear workspace.', icon: Sun },
  { value: 'dark', title: 'Dark', description: 'A softer view in low light.', icon: Moon },
  { value: 'system', title: 'Use device setting', description: 'Follow your device’s appearance.', icon: Monitor }
];

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  return <div className="space-y-6 max-w-4xl">
    <PageHeader title="Settings" lead="Make your workspace feel right for you." />
    <Panel>
      <PanelHeader title="Appearance" description="Choose a light or dark appearance, or follow your device." />
      <div role="radiogroup" aria-label="Color theme" className="grid sm:grid-cols-3 gap-3">
        {THEMES.map(({ value, title, description, icon: Icon }, index) => <button
          type="button" key={value} role="radio" aria-checked={theme === value} tabIndex={theme === value ? 0 : -1}
          onClick={() => setTheme(value)}
          onKeyDown={event => {
            const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
            if (!direction && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? THEMES.length - 1 : (index + direction + THEMES.length) % THEMES.length;
            setTheme(THEMES[next].value);
            (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
          }}
          className={cx('relative text-left rounded-xl border p-4 transition-colors', theme === value ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-sunken')}>
          <span className="flex items-center justify-between mb-6"><Icon className="w-5 h-5 text-brand" />{theme === value && <Check className="w-4 h-4 text-brand" />}</span>
          <span className="flex gap-1.5 mb-3" aria-hidden="true"><span className="w-5 h-2 rounded-full bg-brand" /><span className="w-5 h-2 rounded-full bg-highlight" /></span>
          <span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted-foreground mt-1">{description}</span>
        </button>)}
      </div>
      <p className="text-xs text-muted-foreground mt-4" role="status">Appearance is applied immediately and saved for this browser.</p>
    </Panel>
    <Panel><div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Language</h2><p className="text-sm text-muted-foreground mt-1">Choose your preferred language for supported content.</p></div><LanguageMenu /></div></Panel>
  </div>;
};
