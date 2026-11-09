import React, { useState, useEffect } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell, ActivePage } from './components/AppShell';

import { DashboardView } from './views/DashboardView';
import { FinanceView } from './views/FinanceView';
import { MarketingView } from './views/MarketingView';
import { SuppliersView } from './views/SuppliersView';
import { DocumentsView } from './views/DocumentsView';
import { BossNanaView } from './views/BossNanaView';
import { EfilingView } from './views/EfilingView';
import { PricingView } from './views/PricingView';
import { AboutView } from './views/AboutView';
import { PrivacyView } from './views/PrivacyView';
import { AdminView } from './views/AdminView';
import { AuthView } from './views/AuthView';
import { LanguageMenu } from './components/LanguageMenu';
import { Button, Logo } from './components/ui';

const protectedPages: ActivePage[] = [
  'dashboard',
  'finance',
  'marketing',
  'suppliers',
  'documents',
  'boss-nana'
];

const MainRouter: React.FC = () => {
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState<ActivePage>(() => {
    const hash = window.location.hash.replace('#', '') as ActivePage;
    if (hash && [
      'dashboard', 'finance', 'marketing', 'suppliers', 'documents', 'boss-nana',
      'efiling', 'pricing', 'about', 'privacy', 'admin', 'login', 'register'
    ].includes(hash)) {
      return hash;
    }
    return 'login';
  });

  // Keep hash in sync with active page
  useEffect(() => {
    window.location.hash = activePage;
  }, [activePage]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as ActivePage;
      if (hash) setActivePage(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
          <div key={activePage} className="view-enter">
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
          </div>
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
        return <DashboardView setActivePage={setActivePage} />;
      case 'finance':
        return <FinanceView />;
      case 'marketing':
        return <MarketingView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'documents':
        return <DocumentsView />;
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
    <AppShell activePage={activePage} setActivePage={setActivePage}>
      {renderWorkspaceContent()}
    </AppShell>
  );
};

export function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainRouter />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
