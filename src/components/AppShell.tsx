import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { BossNarraWidget } from './BossNarraWidget';
import { OnboardingModal } from './OnboardingModal';
import { LanguageMenu } from './LanguageMenu';
import { Logo, cx, useDismiss } from './ui';
import {
  LayoutDashboard,
  Coins,
  Store,
  FileText,
  MessageCircle,
  FileCheck2,
  Tag,
  Info,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';

export type ActivePage =
  | 'dashboard'
  | 'finance'
  | 'marketing'
  | 'documents'
  | 'boss-nana'
  | 'efiling'
  | 'pricing'
  | 'about'
  | 'admin'
  | 'login'
  | 'register';

interface AppShellProps {
  activePage: ActivePage;
  setActivePage: (page: ActivePage) => void;
  children: React.ReactNode;
}

type NavItem = { id: ActivePage; label: string; icon: React.ComponentType<{ className?: string }> };

export const AppShell: React.FC<AppShellProps> = ({ activePage, setActivePage, children }) => {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const profileRef = useDismiss(profileOpen, closeProfile);

  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  }, [activePage]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const workspace: NavItem[] = [
    { id: 'dashboard', label: t('appShell.dashboard'), icon: LayoutDashboard },
    { id: 'finance', label: t('appShell.finance'), icon: Coins },
    { id: 'marketing', label: t('appShell.marketing'), icon: Store },
    { id: 'documents', label: t('appShell.documents'), icon: FileText },
    { id: 'boss-nana', label: t('appShell.bossNana'), icon: MessageCircle }
  ];

  const resources: NavItem[] = [
    { id: 'efiling', label: t('appShell.efiling'), icon: FileCheck2 },
    { id: 'pricing', label: t('appShell.pricing'), icon: Tag },
    { id: 'about', label: t('appShell.about'), icon: Info }
  ];

  const staff: NavItem = { id: 'admin', label: t('appShell.staff'), icon: ShieldCheck };

  const initial = (user?.firstName || user?.email || '?')[0].toUpperCase();

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    setActivePage('login');
  };

  const sideLink = (item: NavItem, quiet?: boolean) => {
    const Icon = item.icon;
    const active = activePage === item.id;
    return (
      <button
        type="button"
        onClick={() => setActivePage(item.id)}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm transition-colors',
          active ? 'bg-white/12 text-white font-semibold' : quiet ? 'text-white/55 hover:text-white hover:bg-white/6' : 'text-white/75 hover:text-white hover:bg-white/6'
        )}
      >
        <Icon className={cx('w-[18px] h-[18px] shrink-0', active ? 'text-accent' : 'opacity-80')} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <OnboardingModal />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:sticky md:top-0 md:h-screen w-60 lg:w-64 shrink-0 flex-col bg-night text-white">
        <div className="px-5 pt-6 pb-5">
          <Logo tone="dark" caption="South Cotabato MSMEs" onClick={() => setActivePage('dashboard')} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={t('appShell.primaryNavigation')}>
          <ul className="space-y-0.5">
            {workspace.map((item) => (
              <li key={item.id}>
                {sideLink(item)}
              </li>
            ))}
          </ul>

          <p className="mt-7 mb-2 px-3 text-xs font-semibold text-white/45">{t('appShell.resources')}</p>
          <ul className="space-y-0.5">
            {resources.map((item) => (
              <li key={item.id}>
                {sideLink(item, true)}
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-3 pb-4">
          {sideLink(staff, true)}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-canvas/95 backdrop-blur-sm border-b border-line">
          <div className="h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 md:hidden">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="p-2 -ml-2 rounded-lg text-ink hover:bg-brand-soft"
                aria-label={t('appShell.openMenu')}
                aria-expanded={drawerOpen}
              >
                <Menu className="w-5 h-5" />
              </button>
              <Logo onClick={() => setActivePage('dashboard')} />
            </div>

            <p className="hidden md:block text-sm text-muted truncate">
              {user?.business}
            </p>

            <div className="flex items-center gap-1">
              <LanguageMenu />

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-label="Account menu"
                  className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-full hover:bg-brand-soft transition-colors"
                >
                  <span className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center font-bold text-xs">
                    {initial}
                  </span>
                  <span className="hidden sm:inline text-[13px] font-semibold text-ink max-w-[120px] truncate">
                    {user?.firstName || user?.email}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted" />
                </button>

                {profileOpen && user && (
                  <div role="menu" className="pop-in absolute right-0 mt-1.5 w-64 bg-surface rounded-xl border border-line shadow-[0_12px_32px_-12px_rgb(43_28_51/0.35)] p-1.5 z-50">
                    <div className="px-2.5 py-2">
                      <p className="font-semibold text-sm text-ink truncate">
                        {user.firstName ? `${user.firstName} ${user.lastName}` : 'Enterseed user'}
                      </p>
                      <p className="text-[13px] text-muted truncate">{user.email}</p>
                    </div>
                    <div className="my-1 border-t border-line" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg text-sm text-danger hover:bg-danger-soft"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('appShell.logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </header>

        {/* Mobile slide-in sidebar */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-[55]">
            <div className="fade-in absolute inset-0 bg-night/55" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <aside
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="sheet-in absolute inset-y-0 left-0 w-[min(84vw,320px)] bg-night text-white flex flex-col shadow-[8px_0_40px_-12px_rgb(0_0_0/0.5)]"
            >
              <div className="flex items-center justify-between px-4 h-16 shrink-0">
                <Logo tone="dark" caption="South Cotabato MSMEs" />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 -mr-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
                  aria-label={t('appShell.closeMenu')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Menu navigation">
                <ul className="space-y-0.5">
                  {workspace.map((item) => (
                    <li key={item.id}>{sideLink(item)}</li>
                  ))}
                </ul>
                <p className="mt-6 mb-2 px-3 text-xs font-semibold text-white/45">{t('appShell.resources')}</p>
                <ul className="space-y-0.5">
                  {[...resources, staff].map((item) => (
                    <li key={item.id}>{sideLink(item, true)}</li>
                  ))}
                </ul>
              </nav>

              {user && (
                <div className="border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <p className="text-sm font-semibold truncate">
                    {user.firstName ? `${user.firstName} ${user.lastName}` : user.email}
                  </p>
                  {user.business && <p className="text-[13px] text-white/60 truncate">{user.business}</p>}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-3 w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-white/15 text-sm font-semibold text-white/85 hover:bg-white/10"
                  >
                    <LogOut className="w-4 h-4" />
                    {t('appShell.logout')}
                  </button>
                </div>
              )}
            </aside>
          </div>
        )}

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-28 md:pb-12">
          <div key={activePage} className="view-enter">
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]"
          aria-label={t('appShell.mobileNavigation')}
        >
          {workspace.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePage(item.id)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex flex-col items-center justify-center gap-1 h-16 text-[11px]',
                  active ? 'text-brand font-semibold' : 'text-muted'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-[64px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <BossNarraWidget hidden={activePage === 'boss-nana'} />
    </div>
  );
};
