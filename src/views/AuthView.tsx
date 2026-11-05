import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ActivePage } from '../components/AppShell';
import { LanguageMenu } from '../components/LanguageMenu';
import { LanguageChoice } from '../components/LanguageChoice';
import { PhotoImg } from '../components/PhotoImg';
import { Button, CheckField, Field, Logo, Notice, Segmented, inputClass } from '../components/ui';
import { PHOTOS } from '../photos';

interface AuthViewProps {
  initialMode: 'login' | 'register';
  setActivePage: (page: ActivePage) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ initialMode, setActivePage }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const isRegister = mode === 'register';
  const { login, register, setQuickDemoUser } = useAuth();
  const { t, language, setLanguage, hasChosenLanguage } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [business, setBusiness] = useState('');
  const [agree, setAgree] = useState(false);
  const [remember, setRemember] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister && !agree) {
      setError(t('auth.agreeRequired'));
      return;
    }

    setLoading(true);
    const res = isRegister
      ? await register({ firstName, lastName, email, password, business })
      : await login(email, password, remember);
    setLoading(false);

    if (res.success) {
      setActivePage('dashboard');
    } else {
      setError(res.error || t(isRegister ? 'auth.registerFailed' : 'auth.signInFailed'));
    }
  };

  const handleDemoSignIn = () => {
    setQuickDemoUser({
      email: 'santos.crafts@southcotabato.msme.ph',
      firstName: 'Maria Elena',
      lastName: 'Santos',
      business: 'Santos Weaving & Agricultural Exports (Koronadal)',
      preferredLanguage: language
    });
    setActivePage('dashboard');
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,560px)] xl:grid-cols-[minmax(0,1fr)_600px]">
      {/* Photo side */}
      <aside className="relative h-[19rem] sm:h-96 lg:h-auto lg:min-h-screen lg:sticky lg:top-0 lg:max-h-screen">
        <PhotoImg photo={PHOTOS.carabao} sizes="(min-width: 1024px) 60vw, 100vw" fill eager />
        <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/25 to-night/35 pointer-events-none" />
        <div className="relative h-full flex flex-col justify-between p-5 sm:p-8 lg:p-12 pointer-events-none">
          <Logo tone="dark" caption="South Cotabato MSMEs" />
          <div className="max-w-xl pb-2 lg:pb-8">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.1] max-w-[18ch] sm:max-w-none">
              {t('auth.headline')}
            </h1>
            <p className="hidden sm:block mt-4 text-base lg:text-lg leading-relaxed text-white/85 max-w-lg">
              {t('auth.lead')}
            </p>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <div className="flex flex-col min-h-[calc(100vh-16rem)] lg:min-h-screen">
        <header className="flex items-center justify-end gap-1 px-4 sm:px-8 h-16">
          <nav className="flex items-center text-[13px] font-medium text-muted mr-1">
            {(['about', 'efiling', 'pricing'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setActivePage(p)}
                className="h-9 px-2.5 rounded-lg hover:text-ink hover:bg-brand-soft transition-colors"
              >
                {t(`auth.${p}`)}
              </button>
            ))}
          </nav>
          {hasChosenLanguage && <LanguageMenu />}
        </header>

        <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-8">
          <div className="w-full max-w-sm view-enter" key={hasChosenLanguage ? 'form' : 'lang'}>
            {!hasChosenLanguage ? (
              <>
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">Choose your language</h2>
                <p className="mt-1 mb-6 text-[15px] text-muted" lang="fil">
                  Pumili ng wika. You can change it anytime.
                </p>
                <LanguageChoice onChoose={setLanguage} />
              </>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold tracking-tight text-ink">
                  {t(isRegister ? 'auth.registerTitle' : 'auth.signInTitle')}
                </h2>
                <p className="mt-1 mb-6 text-[15px] text-muted">
                  {t(isRegister ? 'auth.registerLead' : 'auth.welcomeBack')}
                </p>

                <Segmented
                  label="Account"
                  className="w-full mb-6"
                  value={mode}
                  onChange={switchMode}
                  options={[
                    { value: 'login', label: t('auth.signIn') },
                    { value: 'register', label: t('auth.createAccount') }
                  ]}
                />

                {error && (
                  <Notice tone="error" className="mb-4">
                    {error}
                  </Notice>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {isRegister && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={t('auth.firstName')}>
                          {(id) => (
                            <input id={id} type="text" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
                          )}
                        </Field>
                        <Field label={t('auth.lastName')}>
                          {(id) => (
                            <input id={id} type="text" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                          )}
                        </Field>
                      </div>
                      <Field label={t('auth.businessName')}>
                        {(id) => (
                          <input id={id} type="text" required autoComplete="organization" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Tupi Agro-Coffee Roasters" className={inputClass} />
                        )}
                      </Field>
                    </>
                  )}

                  <Field label={t('auth.email')}>
                    {(id) => (
                      <input id={id} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@business.ph" className={inputClass} />
                    )}
                  </Field>

                  <Field label={t('auth.password')} hint={isRegister ? t('auth.passwordHint') : undefined}>
                    {(id) => (
                      <input
                        id={id}
                        type="password"
                        required
                        autoComplete={isRegister ? 'new-password' : 'current-password'}
                        minLength={isRegister ? 12 : 1}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputClass}
                      />
                    )}
                  </Field>

                  {isRegister ? (
                    <CheckField checked={agree} onChange={setAgree} required>
                      {t('auth.agree')}
                    </CheckField>
                  ) : (
                    <CheckField checked={remember} onChange={setRemember}>
                      {t('auth.remember')}
                    </CheckField>
                  )}

                  <Button type="submit" size="lg" disabled={loading} className="w-full">
                    {t(loading ? (isRegister ? 'auth.creating' : 'auth.signingIn') : isRegister ? 'auth.createAccount' : 'auth.signIn')}
                    {!loading && <ArrowRight />}
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t border-line">
                  <Button variant="secondary" className="w-full" onClick={handleDemoSignIn}>
                    {t('auth.demo')}
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted">{t('auth.demoNote')}</p>
                </div>
              </>
            )}
          </div>
        </main>

        <footer className="px-4 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{t('auth.footer')}</span>
          <button type="button" onClick={() => setActivePage('admin')} className="hover:text-ink">
            {t('auth.staffDesk')}
          </button>
        </footer>
      </div>
    </div>
  );
};
