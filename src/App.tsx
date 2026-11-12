import React, { lazy, Suspense, useCallback, useState, useEffect } from 'react';
import { ViewBoundary, ViewLoading } from './components/ViewBoundary';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell, ActivePage } from './components/AppShell';

import { DashboardView } from './views/DashboardView';
const FinanceView = lazy(() => import('./views/FinanceView').then(module => ({ default: module.FinanceView })));
const MarketingView = lazy(() => import('./views/MarketingView').then(module => ({ default: module.MarketingView })));
const SuppliersView = lazy(() => import('./views/SuppliersView').then(module => ({ default: module.SuppliersView })));
const DocumentsView = lazy(() => import('./views/DocumentsView').then(module => ({ default: module.DocumentsView })));
const BossNanaView = lazy(() => import('./views/BossNanaView').then(module => ({ default: module.BossNanaView })));
const EfilingView = lazy(() => import('./views/EfilingView').then(module => ({ default: module.EfilingView })));
const PricingView = lazy(() => import('./views/PricingView').then(module => ({ default: module.PricingView })));
const AboutView = lazy(() => import('./views/AboutView').then(module => ({ default: module.AboutView })));
const PrivacyView = lazy(() => import('./views/PrivacyView').then(module => ({ default: module.PrivacyView })));
const SettingsView = lazy(() => import('./views/SettingsView').then(module => ({ default: module.SettingsView })));
const AdminView = lazy(() => import('./views/AdminView').then(module => ({ default: module.AdminView })));
import { AuthView } from './views/AuthView';
import { LanguageMenu } from './components/LanguageMenu';
import { Button, Logo } from './components/ui';

const protectedPages: ActivePage[] = [
  'dashboard',
  'finance',
  'marketing',
  'suppliers',
  'documents',
  'boss-nana',
  'settings'
];
const validPages = [...protectedPages, 'efiling', 'pricing', 'about', 'privacy', 'admin', 'login', 'register'];

const MainRouter: React.FC = () => {
  const { user, loading } = useAuth();
  const [activePage, updateActivePage] = useState<ActivePage>(() => {
    const hash = window.location.hash.replace('#', '') as ActivePage;
    if (hash && [
      'dashboard', 'finance', 'marketing', 'suppliers', 'documents', 'boss-nana',
      'efiling', 'pricing', 'about', 'privacy', 'settings', 'admin', 'login', 'register'
    ].includes(hash)) {
      return hash;
    }
    return 'login';
  });
  const [requestedDocument, setRequestedDocument] = useState<number | undefined>();
  const setActivePage = useCallback((page: ActivePage) => {
    if (!validPages.includes(page) || page === activePage) return;
    const event = new Event('enterseed:before-navigate', { cancelable: true });
    if (!window.dispatchEvent(event) && !window.confirm('You have unsaved changes. Leave this page without saving?')) {
      history.replaceState(null, '', `#${activePage}`);
      return;
    }
    updateActivePage(page);
  }, [activePage]);

  // Keep hash in sync with active page
  useEffect(() => {
    window.location.hash = activePage;
    document.title = `${activePage === 'boss-nana' ? 'Boss Narra' : activePage.charAt(0).toUpperCase() + activePage.slice(1)} · Enterseed`;
  }, [activePage]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as ActivePage;
      setActivePage(validPages.includes(hash) ? hash : 'login');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [setActivePage]);

  // If user is not logged in and attempts to access protected workspace routes, redirect to login
  useEffect(() => {
    if (!loading && !user && protectedPages.includes(activePage)) {
      setActivePage('login');
    }
  }, [user, loading, activePage]);

  // If user is already logged in and navigates to login or register, redirect to dashboard
  useEffect(() => {
    if (!loading && user && (activePage === 'login' || activePage === 'register')) {
      setActivePage('dashboard');
    }
  }, [user, loading, activePage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-3" role="status">
        <img src="./logos/Icon.png" alt="" className="w-10 h-10 object-contain" />
        <p className="text-sm text-muted">Loading Enterseed…</p>
      </div>
    );
  }

  // 1. Standalone Login / Registration Pages (Separated from workspace)
  if (!user && (activePage === 'login' || activePage === 'register')) {
    return <AuthView initialMode={activePage} setActivePage={setActivePage} />;
  }

  const isStaff = user?.role === 'admin' || user?.role === 'staff';

  // 2. Unauthenticated views of public pages (e.g. About, Pricing, E-Filing, Privacy) with a clean public header
  if (!user) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur-sm border-b border-line">
          <div className="max-w-6xl mx-auto h-16 px-4 sm:px-8 flex items-center justify-between gap-3">
            <Logo onClick={() => setActivePage('login')} />
            <div className="flex items-center gap-1 sm:gap-2">
              <LanguageMenu />
              <Button variant="ghost" size="sm" onClick={() => setActivePage('login')}>
                Sign in
              </Button>
              <span className="hidden sm:block">
                <Button size="sm" onClick={() => setActivePage('register')}>
                  Create account
                </Button>
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
          <ViewBoundary key={activePage}><Suspense fallback={<ViewLoading />}><div className="view-enter">
            {activePage === 'pricing' && <PricingView />}
            {activePage === 'about' && <AboutView />}
            {activePage === 'efiling' && <EfilingView />}
            {activePage === 'privacy' && <PrivacyView />}
            {activePage === 'admin' && (
              <div className="text-center py-12">
                <h2 className="text-lg font-semibold text-ink">Staff Console Restricted</h2>
                <p className="text-sm text-muted mt-1">Please sign in with a verified staff account to continue.</p>
                <Button className="mt-4" onClick={() => setActivePage('login')}>Sign in</Button>
              </div>
            )}
          </div></Suspense></ViewBoundary>
        </main>

        <footer className="w-full border-t border-line bg-surface py-4 px-4 sm:px-8 text-center text-xs text-muted">
          <p>
            <strong className="font-semibold text-ink">Enterseed is an independent support tool.</strong> Always confirm requirements with DTI, your LGU, and BIR. Built for South Cotabato MSMEs.
          </p>
        </footer>
      </div>
    );
  }

  // 3. Authenticated Workspace (Wrapped in AppShell with Sidebar, Topbar, and Dashboard)
  const renderWorkspaceContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardView setActivePage={setActivePage} openDocument={id => { setRequestedDocument(id); setActivePage('documents'); }} />;
      case 'finance':
        return <FinanceView />;
      case 'marketing':
        return <MarketingView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'documents':
        return <DocumentsView requestedDocumentId={requestedDocument} onDocumentOpened={() => setRequestedDocument(undefined)} />;
      case 'boss-nana':
        return <BossNanaView />;
      case 'efiling':
        return <EfilingView />;
      case 'pricing':
        return <PricingView />;
      case 'about':
        return <AboutView />;
      case 'privacy':
        return <PrivacyView />;
      case 'settings':
        return <SettingsView />;
      case 'admin':
        if (!isStaff) {
          return (
            <div className="bg-surface rounded-2xl border border-line p-8 text-center max-w-md mx-auto my-12">
              <h2 className="text-lg font-semibold text-ink">Staff Console Restricted</h2>
              <p className="text-sm text-muted mt-2">
                Your account does not have staff or administrator privileges. Only DTI / Negosyo Center partner staff may access this view.
              </p>
              <Button className="mt-5" onClick={() => setActivePage('dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          );
        }
        return <AdminView />;
      default:
        return <DashboardView setActivePage={setActivePage} />;
    }
  };

  return (
    <AppShell key={user.email} activePage={activePage} setActivePage={setActivePage}>
      <ViewBoundary key={activePage}><Suspense fallback={<ViewLoading />}>{renderWorkspaceContent()}</Suspense></ViewBoundary>
    </AppShell>
  );
};

export function App() {
  return (
    <ThemeProvider><LanguageProvider>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </LanguageProvider></ThemeProvider>
  );
}

export default App;
