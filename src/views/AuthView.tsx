import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Leaf, MapPin, Play, Sprout, TrendingUp } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ActivePage } from '../components/AppShell';
import { LanguageMenu } from '../components/LanguageMenu';
import { LanguageChoice } from '../components/LanguageChoice';
import { PhotoImg } from '../components/PhotoImg';
import { Button, CheckField, Field, Logo, Notice, Segmented, inputClass } from '../components/ui';
import { PHOTOS } from '../photos';
import { isStaticDemoHost } from '../services/apiClient';

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
  const [municipality, setMunicipality] = useState('City of Koronadal');
  const [agree, setAgree] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staticPreview = isStaticDemoHost();

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setShowPassword(false);
  }, [initialMode]);

  const switchMode = (next: 'login' | 'register') => {
    if (loading) return;
    setMode(next);
    setError(null);
    setShowPassword(false);
    setActivePage(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (isRegister && !agree) {
      setError(t('auth.agreeRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = isRegister
        ? await register({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, business: business.trim(), municipality })
        : await login(email.trim(), password, remember);
      if (res.success) {
        setActivePage('dashboard');
      } else {
        setError(res.error || t(isRegister ? 'auth.registerFailed' : 'auth.signInFailed'));
      }
    } catch {
      setError('We couldn’t connect. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    setQuickDemoUser({
      email: 'maria.santos@matutumcoffee.ph',
      firstName: 'Maria Elena',
      lastName: 'Santos',
      business: 'Matutum Highlands Coffee',
      municipality: 'City of Koronadal',
      role: 'owner',
      preferredLanguage: language
    });
    setActivePage('dashboard');
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,560px)] xl:grid-cols-[minmax(0,1fr)_600px]">
      {/* Photo side */}
      <aside className="relative h-[13rem] sm:h-[20rem] lg:h-screen lg:sticky lg:top-0 overflow-hidden bg-night">
        <PhotoImg photo={PHOTOS.carabao} sizes="(min-width: 1024px) 60vw, 100vw" fill eager credit="none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#191715]/95 via-[#2A211F]/40 to-[#2A211F]/35 pointer-events-none" />
        <div className="relative h-full flex flex-col justify-between p-6 sm:p-9 lg:p-12 xl:p-16 pointer-events-none">
          <div className="flex items-start justify-between gap-3">
            <Logo tone="dark" caption="Rooted locally. Growing together." />
            <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white backdrop-blur-md">
              <MapPin className="w-3 h-3" /> South Cotabato
            </span>
          </div>
          <div className="max-w-xl pb-3 lg:pb-6 view-enter">
            <p className="hidden sm:block mb-4 text-sm text-white/80">For the businesses that keep our communities growing</p>
            <h1 className="text-[2rem] sm:text-[2.75rem] xl:text-[3.5rem] font-extrabold tracking-[-0.04em] text-white leading-[1.08] max-w-[16ch]">
              {t('auth.headline')}
            </h1>
            <p className="hidden sm:block mt-5 text-[15px] lg:text-base leading-relaxed text-white/80 max-w-md">
              {t('auth.lead')}
            </p>
            <div className="hidden lg:grid grid-cols-3 gap-3 mt-9 pt-6 border-t border-white/20">
              {[{ icon: TrendingUp, title: 'Clarity', text: 'Know your numbers' }, { icon: Sprout, title: 'Direction', text: 'Plan your next step' }, { icon: Leaf, title: 'Community', text: 'Build local connections' }].map(({ icon: Icon, title, text }) => (
                <div key={title}>
                  <Icon className="w-5 h-5 text-highlight mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-[11px] leading-relaxed mt-1 text-white/65">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <div className="flex flex-col min-h-[calc(100vh-16rem)] lg:min-h-screen">
        <header className="flex items-center justify-end gap-1 px-4 sm:px-8 min-h-16 py-2 border-b border-line/50">
          <nav aria-label="Explore Enterseed" className="flex items-center text-[13px] font-medium text-muted-foreground mr-1">
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

        <main className="flex-1 flex items-center justify-center px-5 sm:px-10 py-9 sm:py-12">
          <div className="w-full max-w-[390px] view-enter" key={hasChosenLanguage ? 'form' : 'lang'}>
            <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Sprout className="w-6 h-6" strokeWidth={1.5} /></span>
            {!hasChosenLanguage ? (
              <>
                <p className="section-label mb-2">Make yourself at home</p>
                <h2 className="text-[1.8rem] font-extrabold tracking-tight text-ink">Choose your language</h2>
                <p className="mt-1 mb-6 text-[15px] text-muted-foreground" lang="fil">
                  Pumili ng wika. You can change it anytime.
                </p>
                <LanguageChoice onChoose={setLanguage} />
              </>
            ) : (
              <>
                <h2 className="text-[1.8rem] font-extrabold tracking-tight text-ink">
                  {t(isRegister ? 'auth.registerTitle' : 'auth.signInTitle')}
                </h2>
                <p className="mt-1 mb-6 text-[15px] text-muted-foreground">
                  {t(isRegister ? 'auth.registerLead' : 'auth.welcomeBack')}
                </p>

                {staticPreview && <Notice className="mb-5">You’re viewing the interactive demo. Explore the sample workspace below; account sign-in is available when a server is connected.</Notice>}

                {!staticPreview && <Segmented
                  label="Account"
                  className="w-full mb-6"
                  value={mode}
                  onChange={switchMode}
                  options={[
                    { value: 'login', label: t('auth.signIn') },
                    { value: 'register', label: t('auth.createAccount') }
                  ]}
                />}

                {error && (
                  <Notice tone="error" className="mb-4">
                    {error}
                  </Notice>
                )}

                {!staticPreview && <form onSubmit={handleSubmit} aria-busy={loading}>
                  <fieldset disabled={loading} className="space-y-4 disabled:opacity-75 transition-opacity">
                  {isRegister && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={t('auth.firstName')}>
                          {(id) => (
                            <input id={id} type="text" required maxLength={80} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
                          )}
                        </Field>
                        <Field label={t('auth.lastName')}>
                          {(id) => (
                            <input id={id} type="text" required maxLength={80} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
                          )}
                        </Field>
                      </div>
                      <Field label={t('auth.businessName')}>
                        {(id) => (
                          <input id={id} type="text" required maxLength={160} autoComplete="organization" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Tupi Agro-Coffee Roasters" className={inputClass} />
                        )}
                      </Field>
                    </>
                  )}

                  <Field label={t('auth.email')}>
                    {(id) => (
                      <input id={id} type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@business.ph" className={inputClass} />
                    )}
                  </Field>

                  <Field label={t('auth.password')} hint={isRegister ? t('auth.passwordHint') : undefined}>
                    {(id) => (
                      <div className="relative">
                      <input
                        id={id}
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete={isRegister ? 'new-password' : 'current-password'}
                        minLength={isRegister ? 12 : 1}
                        maxLength={128}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass} pr-12`}
                      />
                      <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls={id} className="absolute right-1 top-1 bottom-1 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-brand hover:bg-brand-soft transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      </div>
                    )}
                  </Field>

                  {isRegister && (
                    <Field label="Municipality (South Cotabato)">
                      {(id) => (
                        <select
                          id={id}
                          value={municipality}
                          onChange={(e) => setMunicipality(e.target.value)}
                          className={inputClass}
                        >
                          <option value="City of Koronadal">City of Koronadal</option>
                          <option value="Polomolok">Polomolok</option>
                          <option value="Tupi">Tupi</option>
                          <option value="Surallah">Surallah</option>
                          <option value="Lake Sebu">Lake Sebu</option>
                          <option value="Norala">Norala</option>
                          <option value="Tampakan">Tampakan</option>
                          <option value="Banga">Banga</option>
                          <option value="Santo Niño">Santo Niño</option>
                          <option value="Tantangan">Tantangan</option>
                          <option value="T'boli">T'boli</option>
                        </select>
                      )}
                    </Field>
                  )}

                  {isRegister ? (
                    <CheckField checked={agree} onChange={setAgree} required>
                      <span>
                        I agree to Enterseed storing my account and workspace records as described in the{' '}
                        <a
                          href="#privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand underline"
                        >
                          Privacy Policy
                        </a>.
                      </span>
                    </CheckField>
                  ) : (
                    <CheckField checked={remember} onChange={setRemember}>
                      {t('auth.remember')}
                    </CheckField>
                  )}

                  <Button type="submit" size="lg" disabled={loading} busy={loading} className="w-full shine-button">
                    {t(loading ? (isRegister ? 'auth.creating' : 'auth.signingIn') : isRegister ? 'auth.createAccount' : 'auth.signIn')}
                    {!loading && <ArrowRight />}
                  </Button>
                  </fieldset>
                </form>}

                <div className="mt-6 pt-6 border-t border-line">
                  <Button variant={staticPreview ? 'primary' : 'secondary'} size="lg" className="w-full" onClick={handleDemoSignIn} disabled={loading}>
                    <Play className="w-4 h-4" />
                    {t('auth.demo')}
                  </Button>
                  <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">Try the tools with sample data. No sign-up needed.<br />Demo changes stay in this browser.</p>
                </div>
              </>
            )}
          </div>
        </main>

        <footer className="px-4 sm:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground border-t border-line/60">
          <p className="text-center sm:text-left">
            Enterseed is an independent support tool. Always confirm requirements with DTI, your LGU, and BIR.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setActivePage('privacy')} className="hover:text-ink underline">
              Privacy (RA 10173)
            </button>
            <button type="button" onClick={() => setActivePage('about')} className="hover:text-ink">
              About
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
