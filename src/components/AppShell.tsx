import { useCopy } from '../features/guidance/shared';
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
  FlaskConical,
  Settings
} from './icons';

export type ActivePage =
  'plan' | 'calendar' | 'support' | 'opportunities' | 'costing' | 'quotations' | 'guides' | 'staff-support' | 'staff-opportunities' | 'staff-metrics'
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
  | 'settings'
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
  const c = useCopy();
  const { user, logout, isDemo } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
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
      const buttons = Array.from(drawerRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []).filter(button => button.getClientRects().length > 0);
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
    { id: 'documents', label: 'Document studio', icon: FileText },
    { id: 'boss-nana', label: 'Boss Narra AI', icon: MessageCircle }
  ];

  workspace.splice(1, 0, { id: 'plan', label: c('My business plan'), icon: Sprout }, { id: 'calendar', label: c('Business calendar'), icon: FileCheck2 }, { id: 'opportunities', label: c('Business opportunities'), icon: Store }, { id: 'support', label: c('Support requests'), icon: MessageCircle });
  workspace.push({ id: 'costing', label: c('Product costing'), icon: Coins }, { id: 'quotations', label: c('Supplier quotation comparison'), icon: Store }, { id: 'guides', label: c('Learning guides'), icon: FileText });
  if (user?.role === 'admin' || user?.role === 'staff') workspace.push({ id: 'staff-support', label: c('Staff follow-up desk'), icon: ShieldCheck }, { id: 'staff-opportunities', label: c('Opportunity publishing'), icon: ShieldCheck }, { id: 'staff-metrics', label: c('Business impact'), icon: ShieldCheck });

  const resources: NavItem[] = [
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'pricing', label: t('appShell.pricing'), icon: Tag },
    { id: 'about', label: t('appShell.about'), icon: Info },
    { id: 'privacy', label: 'Privacy (RA 10173)', icon: ShieldCheck }
  ];

  const isStaff = user?.role === 'admin' || user?.role === 'staff';
  const staff: NavItem = { id: 'admin', label: t('appShell.staff'), icon: ShieldCheck };
  const allItems = [...workspace, ...resources, ...(isStaff ? [staff] : [])];
  const groupItems = (ids: ActivePage[]) => ids.map(id => allItems.find(item => item.id === id)!);
  const groups = [
    { id: 'business', label: c('Business management'), icon: Sprout, items: groupItems(['plan', 'calendar', 'documents', 'efiling']) },
    { id: 'finance', label: c('Finance'), icon: Coins, items: groupItems(['finance', 'costing']) },
    { id: 'market', label: c('Markets & suppliers'), icon: Store, items: groupItems(['marketing', 'suppliers', 'quotations', 'opportunities']) },
    { id: 'help', label: c('Help & learning'), icon: MessageCircle, items: groupItems(['boss-nana', 'support', 'guides']) },
    { id: 'account', label: c('Account & resources'), icon: Settings, items: resources },
    ...(isStaff ? [{ id: 'staff', label: c('Staff tools'), icon: ShieldCheck, items: groupItems(['admin', 'staff-support', 'staff-opportunities', 'staff-metrics']) }] : [])
  ];
  const activeGroup = groups.find(group => group.items.some(item => item.id === activePage))?.id;
  useEffect(() => { setExpandedGroup(activeGroup || null); }, [activePage, activeGroup]);

  const searchTerms: Partial<Record<ActivePage, string>> = {
    finance: 'cash sales expenses ledger debt loans tax equipment roi reports money',
    marketing: 'facebook post promotion message price list catalog customers',
    suppliers: 'packaging materials vendors partners directory',
    documents: 'business plan feasibility proposal pdf library drafts',
    efiling: 'permits bir dti registration requirements filing',
    settings: 'dark light theme appearance language preferences',
    privacy: 'export delete account data',
    'boss-nana': 'help assistant advice chat questions'
  };
  const searchResults = allItems.filter(item => `${item.label} ${searchTerms[item.id] || ''}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));

  const initial = (user?.firstName || user?.email || '?')[0].toUpperCase();
  useEffect(() => { setSearchIndex(0); }, [searchQuery, searchOpen]);
  useEffect(() => {
    if (searchOpen) document.getElementById(`workspace-result-${searchIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [searchIndex, searchOpen]);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    setActivePage('login');
  };

  const sideLink = (item: NavItem, nested = false) => {
    const Icon = item.icon;
    const active = activePage === item.id;
    return (
      <button
        type="button"
        onClick={() => setActivePage(item.id)}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'nav-link w-full flex items-center justify-start gap-3 min-h-11 py-2 px-3 rounded-md text-left text-[13px] transition-colors',
          nested && 'pl-3',
          active ? 'bg-brand-soft text-brand font-medium' : 'text-muted-foreground hover:text-ink hover:bg-sunken'
        )}
      >
        {item.id === 'boss-nana' ? (
          <img src="./logos/Narra.png" alt="" className="w-[18px] h-[18px] shrink-0 object-contain" />
        ) : (
          <Icon className={cx('w-[18px] h-[18px] shrink-0', active ? 'text-brand' : 'opacity-80')} />
        )}
        <span className="min-w-0 flex-1 text-left leading-5">{item.label}</span>
      </button>
    );
  };

  const groupedNavigation = (surface: 'desktop' | 'mobile') => (
    <ul className="space-y-1">
      <li>{sideLink(workspace[0])}</li>
      {groups.map(group => {
        const open = expandedGroup === group.id;
        const containsActive = activeGroup === group.id;
        const Icon = group.icon;
        const panelId = `${surface}-nav-${group.id}`;
        return <li key={group.id}>
          <button type="button" aria-expanded={open} aria-controls={panelId}
            onClick={() => setExpandedGroup(open ? null : group.id)}
            className={cx('flex w-full min-h-11 items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] hover:bg-sunken transition-colors', containsActive ? 'font-semibold text-brand' : 'text-muted-foreground')}>
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="min-w-0 flex-1 leading-5">{group.label}</span>
            <ChevronDown aria-hidden="true" className={cx('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
          </button>
          <ul id={panelId} hidden={!open} className="ml-5 my-1 space-y-0.5 border-l border-line pl-2">
            {group.items.map(item => <li key={item.id}>{sideLink(item, true)}</li>)}
          </ul>
        </li>;
      })}
    </ul>
  );

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <a href="#workspace-content" onClick={event => { event.preventDefault(); document.getElementById('workspace-content')?.focus(); }} className="skip-link">Skip to content</a>
      <OnboardingModal />

      {/* Desktop sidebar */}
      <aside className="workspace-sidebar hidden md:flex md:sticky md:top-0 md:h-screen w-60 lg:w-64 shrink-0 flex-col text-ink">
        <div className="px-5 pt-6 pb-5">
          <Logo onClick={() => setActivePage('dashboard')} />
          <div className="mt-5 rounded-lg border border-line bg-surface px-3 py-2.5"><p className="text-xs font-semibold truncate">{user?.business || 'Your workspace'}</p><p className="mt-1 text-xs text-muted-foreground">{isStaff ? 'Staff & business workspace' : 'Business workspace'}</p></div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label={t('appShell.primaryNavigation')}>
          {groupedNavigation('desktop')}
        </nav>

        <div className="p-4">
          <button type="button" onClick={() => setActivePage('boss-nana')} className="group w-full text-left rounded-lg border border-line bg-surface p-3 transition-colors hover:bg-sunken">
            <img src="./logos/Narra.png" alt="" className="w-9 h-9 rounded-xl bg-white object-contain p-1" />
            <span className="block mt-3 text-[13px] font-semibold">Need a hand?</span>
            <span className="block mt-1 text-xs leading-relaxed text-muted-foreground">Talk things through with Boss Narra.</span>
          </button>
          <p className="flex items-center gap-2 mt-5 px-2 text-[10px] text-muted-foreground"><Sprout className="w-4 h-4 text-highlight/80" />Rooted in South Cotabato</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-sm border-b border-line">
          <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
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

            <p className="hidden md:flex items-center gap-2 text-[13px] text-muted-foreground truncate">
              <span className="hidden lg:inline">Workspace</span><ChevronRight className="hidden lg:block w-3.5 h-3.5" />
              <span className="font-semibold text-ink">{allItems.find(item => item.id === activePage)?.label || 'Overview'}</span>
            </p>

            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search workspace" className="flex items-center gap-2 h-9 px-2.5 rounded-lg text-muted-foreground hover:bg-brand-soft"><Search className="w-4 h-4" /><span className="hidden xl:inline text-xs">Find a tool</span><kbd className="hidden xl:inline text-[10px] border border-line rounded px-1.5 py-0.5">Ctrl K</kbd></button>
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
                  <span className="w-7 h-7 rounded-full bg-brand text-primary-foreground flex items-center justify-center font-bold text-xs">
                    {initial}
                  </span>
                  <span className="hidden sm:inline text-[13px] font-semibold text-ink max-w-[120px] truncate">
                    {user?.firstName || user?.email}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {profileOpen && user && (
                  <div role="menu" className="preset-menu pop-in absolute right-0 mt-1.5 w-64 bg-surface rounded-xl border border-line shadow-[0_12px_32px_-12px_rgb(28_25_23/0.35)] p-1.5 z-50">
                    <div className="px-2.5 py-2">
                      <p className="font-semibold text-sm text-ink truncate">
                        {user.firstName ? `${user.firstName} ${user.lastName}` : 'Enterseed user'}
                      </p>
                      <p className="text-[13px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="my-1 border-t border-line" />
                    <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); setActivePage('settings'); }} className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg text-sm text-ink hover:bg-sunken">
                      <Settings className="w-4 h-4" />Settings
                    </button>
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
              className="sheet-in absolute inset-y-0 left-0 w-[min(84vw,320px)] bg-surface text-ink flex flex-col shadow-[8px_0_40px_-12px_rgb(0_0_0/0.5)]"
            >
              <div className="flex items-center justify-between px-4 h-16 shrink-0">
                <Logo caption="South Cotabato MSMEs" />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 -mr-1 rounded-lg text-muted-foreground hover:text-ink hover:bg-sunken"
                  aria-label={t('appShell.closeMenu')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Menu navigation">
                {groupedNavigation('mobile')}
              </nav>

              {user && (
                <div className="border-t border-line px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <p className="text-sm font-semibold truncate">
                    {user.firstName ? `${user.firstName} ${user.lastName}` : user.email}
                  </p>
                  {user.business && <p className="text-[13px] text-muted-foreground truncate">{user.business}</p>}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-3 w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-line text-sm font-semibold text-ink hover:bg-sunken"
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

        <footer className="w-full border-t border-line bg-surface py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          <p>
            <strong className="font-semibold text-ink">Enterseed is an independent support tool.</strong> Always confirm requirements with DTI, your LGU, and BIR. Built for South Cotabato MSMEs.
          </p>
        </footer>
      </div>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Where would you like to go?" description="Find a tool or your next step for your business.">
        <input type="search" role="combobox" aria-expanded="true" aria-controls="workspace-results" aria-autocomplete="list" aria-activedescendant={searchResults.length ? `workspace-result-${searchIndex}` : undefined} aria-label="Find a workspace tool" placeholder="Try finance, suppliers, or documents…" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setSearchIndex(index => searchResults.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + searchResults.length) % searchResults.length : 0);
          }
          if (event.key === 'Enter' && searchResults[searchIndex]) { event.preventDefault(); setActivePage(searchResults[searchIndex].id); setSearchOpen(false); }
        }} className={inputClass} />
        <div id="workspace-results" role="listbox" aria-label="Workspace tools" className="mt-3 space-y-1 max-h-[45vh] overflow-auto">
          {searchResults.map((item, index) => <button type="button" role="option" aria-selected={index === searchIndex} id={`workspace-result-${index}`} key={item.id} onClick={() => { setActivePage(item.id); setSearchOpen(false); }} className={cx('flex items-center gap-3 w-full p-3 rounded-md text-left text-sm hover:bg-brand-soft', index === searchIndex && 'bg-brand-soft')}><item.icon className="w-4 h-4 text-brand" /><span className="flex-1">{item.label}</span><ChevronRight className="w-4 h-4 text-muted-foreground" /></button>)}
          {searchResults.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No tools found. Try cash, permits, or business plan.</p>}
        </div>
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted-foreground">Use ↑ ↓ to browse, Enter to open, and Esc to close.</p>
      </Modal>

      <BossNarraWidget hidden={activePage === 'boss-nana'} />
    </div>
  );
};
