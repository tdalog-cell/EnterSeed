import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { BossNarraWidget } from './BossNarraWidget';
import { OnboardingModal } from './OnboardingModal';
import { LanguageMenu } from './LanguageMenu';
import { Logo, Modal, inputClass, cx, useDismiss } from './ui';
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
  ChevronDown,
  Megaphone,
  Download,
  Lock,
  Search,
  ChevronRight,
  Sprout,
  FlaskConical
} from 'lucide-react';

export type ActivePage =
  | 'dashboard'
  | 'finance'
  | 'marketing'
  | 'suppliers'
  | 'documents'
  | 'boss-nana'
  | 'efiling'
  | 'pricing'
  | 'about'
  | 'privacy'
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
  const { user, logout, isDemo } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const profileRef = useDismiss(profileOpen, closeProfile);

  useEffect(() => {
    setDrawerOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
    window.scrollTo({ top: 0 });
  }, [activePage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSearchOpen(current => !current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const handleNav = (e: Event) => {
      const customEvent = e as CustomEvent<ActivePage>;
      if (customEvent.detail) {
        setActivePage(customEvent.detail);
      }
    };
    window.addEventListener('navigate-tab', handleNav);
    return () => window.removeEventListener('navigate-tab', handleNav);
  }, [setActivePage]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
      if (e.key !== 'Tab') return;
      const buttons = Array.from(drawerRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      previousFocus?.focus();
    };
  }, [drawerOpen]);

  const workspace: NavItem[] = [
    { id: 'dashboard', label: t('appShell.dashboard'), icon: LayoutDashboard },
    { id: 'finance', label: t('appShell.finance'), icon: Coins },
    { id: 'marketing', label: 'Marketing', icon: Megaphone },
    { id: 'suppliers', label: 'Supplier Network', icon: Store },
    { id: 'efiling', label: 'Registration Assistant', icon: FileCheck2 },
    { id: 'documents', label: 'AI Document Studio', icon: FileText },
    { id: 'boss-nana', label: 'Boss Narra AI', icon: MessageCircle }
  ];

  const resources: NavItem[] = [
    { id: 'pricing', label: t('appShell.pricing'), icon: Tag },
    { id: 'about', label: t('appShell.about'), icon: Info },
    { id: 'privacy', label: 'Privacy (RA 10173)', icon: ShieldCheck }
  ];

  const isStaff = user?.role === 'admin' || user?.role === 'staff';
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
          'nav-link w-full flex items-center gap-3 min-h-11 px-3.5 rounded-xl text-[13px] transition-colors',
          active ? 'bg-white/12 text-white font-semibold' : quiet ? 'text-white/55 hover:text-white hover:bg-white/6' : 'text-white/75 hover:text-white hover:bg-white/6'
        )}
      >
        {item.id === 'boss-nana' ? (
          <img src="./logos/Narra.png" alt="" className="w-[18px] h-[18px] shrink-0 object-contain" />
        ) : (
          <Icon className={cx('w-[18px] h-[18px] shrink-0', active ? 'text-accent' : 'opacity-80')} />
        )}
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <a href="#workspace-content" className="skip-link">Skip to content</a>
      <OnboardingModal />

      {/* Desktop sidebar */}
      <aside className="workspace-sidebar hidden md:flex md:sticky md:top-0 md:h-screen w-60 lg:w-64 shrink-0 flex-col text-white">
        <div className="px-6 pt-8 pb-8">
          <Logo tone="dark" onClick={() => setActivePage('dashboard')} />
          <p className="mt-3 text-[9px] font-semibold tracking-[.18em] uppercase text-white/45">Small business. Big possibilities.</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={t('appShell.primaryNavigation')}>
          <p className="px-3 mb-3 text-[9px] font-bold tracking-[.18em] uppercase text-white/40">Your workspace</p>
          <ul className="space-y-0.5">
            {workspace.map((item) => (
              <li key={item.id}>
                {sideLink(item)}
              </li>
            ))}
          </ul>

          <p className="mt-8 mb-3 px-3 text-[9px] uppercase tracking-[.18em] font-semibold text-white/45">{t('appShell.resources')}</p>
          <ul className="space-y-0.5">
            {resources.map((item) => (
              <li key={item.id}>
                {sideLink(item, true)}
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4">
          <button type="button" onClick={() => setActivePage('boss-nana')} className="group w-full text-left rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
            <img src="./logos/Narra.png" alt="" className="w-9 h-9 rounded-xl bg-white object-contain p-1" />
            <span className="block mt-3 text-[13px] font-semibold">A little guidance goes a long way.</span>
            <span className="block mt-1 text-xs leading-relaxed text-white/55">Talk things through with Boss Narra.</span>
          </button>
          <p className="flex items-center gap-2 mt-5 px-2 text-[10px] text-white/45"><Sprout className="w-4 h-4 text-accent/80" />Rooted in South Cotabato</p>
        </div>
        {isStaff && (
          <div className="px-3 pb-4 border-t border-white/10 pt-3">
            {sideLink(staff, true)}
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-xl border-b border-line">
          <div className="h-[72px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
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

            <p className="hidden md:flex items-center gap-2 text-[13px] text-muted truncate">
              <span className="hidden lg:inline">Workspace</span><ChevronRight className="hidden lg:block w-3.5 h-3.5" />
              <span className="font-semibold text-ink">{[...workspace, ...resources, staff].find(item => item.id === activePage)?.label || 'Overview'}</span>
            </p>

            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search workspace" className="flex items-center gap-2 h-9 px-2.5 rounded-lg text-muted hover:bg-brand-soft"><Search className="w-4 h-4" /><span className="hidden xl:inline text-xs">Find a tool</span><kbd className="hidden xl:inline text-[10px] border border-line rounded px-1.5 py-0.5">Ctrl K</kbd></button>
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
              ref={drawerRef}
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
                  {[...resources, ...(isStaff ? [staff] : [])].map((item) => (
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

        {isDemo && <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-brand-soft/70 px-4 py-2 text-[11px] text-brand"><FlaskConical className="w-3.5 h-3.5" /><strong>Demo workspace</strong><span>Saved in this browser. Applications and messages are not submitted.</span></div>}
        <main id="workspace-content" tabIndex={-1} className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12 outline-none">
          <div key={activePage} className="view-enter">
            {children}
          </div>
        </main>

        <footer className="w-full border-t border-line bg-surface py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted">
          <p>
            <strong className="font-semibold text-ink">Enterseed is an independent support tool.</strong> Always confirm requirements with DTI, your LGU, and BIR. Built for South Cotabato MSMEs.
          </p>
        </footer>
      </div>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Where would you like to go?" description="Find a tool or your next step for your business.">
        <input type="search" aria-label="Find a workspace tool" placeholder="Try finance, suppliers, or documents…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} className={inputClass} />
        <div className="mt-3 space-y-1 max-h-[45vh] overflow-auto">
          {[...workspace, ...resources, ...(isStaff ? [staff] : [])].filter(item => item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())).map(item => <button type="button" key={item.id} onClick={() => { setActivePage(item.id); setSearchOpen(false); }} className="flex items-center gap-3 w-full p-3 rounded-xl text-left text-sm hover:bg-brand-soft"><item.icon className="w-4 h-4 text-brand" /><span className="flex-1">{item.label}</span><ChevronRight className="w-4 h-4 text-muted" /></button>)}
          {![...workspace, ...resources].some(item => item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())) && <p className="text-sm text-muted text-center py-6">No tools found. Try a different search.</p>}
        </div>
      </Modal>

      <BossNarraWidget hidden={activePage === 'boss-nana'} />
    </div>
  );
};
