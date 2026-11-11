import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLanguage, Language } from './LanguageContext';
import { apiFetch, getDemoUser, isDemoMode, startDemoSession, endDemoSession, isStaticDemoHost } from '../services/apiClient';

export interface User {
  id?: number;
  email: string;
  firstName: string;
  lastName: string;
  business: string;
  municipality?: string;
  role?: 'owner' | 'staff' | 'admin';
  preferredLanguage?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isDemo: boolean;
  needsLanguageSelection: boolean;
  setNeedsLanguageSelection: (val: boolean) => void;
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (data: { firstName: string; lastName: string; email: string; password: string; business: string; municipality?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateLanguagePreference: (lang: Language) => Promise<void>;
  exportUserData: () => Promise<void>;
  deleteUserData: () => Promise<boolean>;
  setQuickDemoUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => isDemoMode() ? null : sessionStorage.getItem('enterseed_token') || localStorage.getItem('enterseed_token'));
  const [isDemo, setIsDemo] = useState(isDemoMode);
  const [loading, setLoading] = useState(true);
  const [needsLanguageSelection, setNeedsLanguageSelection] = useState(false);
  const { setLanguage } = useLanguage();

  const fetchCurrentUser = async (authToken?: string) => {
    try {
      const demoUser = getDemoUser();
      if (demoUser) {
        setUser(demoUser as User);
        setIsDemo(true);
        setToken(null);
        if (demoUser.preferredLanguage) setLanguage(demoUser.preferredLanguage as Language);
        return;
      }
      const activeToken = authToken || token;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const res = await apiFetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (data.user.preferredLanguage) {
            setLanguage(data.user.preferredLanguage as Language);
          } else {
            setNeedsLanguageSelection(true);
          }
        }
      } else {
        setUser(null);
        if (res.status === 401) {
          setToken(null);
          localStorage.removeItem('enterseed_token');
          sessionStorage.removeItem('enterseed_token');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch authenticated user:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, password: string, remember = false): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isStaticDemoHost()) endDemoSession();
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed.' };
      }
      setIsDemo(false);
      setUser(data.user);
      localStorage.removeItem('enterseed_token');
      sessionStorage.removeItem('enterseed_token');
      if (data.sessionToken) {
        setToken(data.sessionToken);
        if (remember) {
          localStorage.setItem('enterseed_token', data.sessionToken);
        } else {
          sessionStorage.setItem('enterseed_token', data.sessionToken);
        }
      }
      setNeedsLanguageSelection(Boolean(data.needsLanguageSelection));
      if (data.needsLanguageSelection) {
        setNeedsLanguageSelection(true);
      } else if (data.user.preferredLanguage) {
        setLanguage(data.user.preferredLanguage as Language);
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Could not connect to server. Please try again.' };
    }
  };

  const register = async (data: { firstName: string; lastName: string; email: string; password: string; business: string; municipality?: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isStaticDemoHost()) endDemoSession();
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...data, agree: true })
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Registration failed.' };
      }
      setIsDemo(false);
      setUser(resData.user);
      localStorage.removeItem('enterseed_token');
      sessionStorage.removeItem('enterseed_token');
      if (resData.sessionToken) {
        setToken(resData.sessionToken);
        sessionStorage.setItem('enterseed_token', resData.sessionToken);
      }
      setNeedsLanguageSelection(true);
      return { success: true };
    } catch {
      return { success: false, error: 'Could not connect to server. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await apiFetch('/api/auth/logout', { method: 'POST', headers });
    } catch {
      // ignore
    } finally {
      endDemoSession();
      setIsDemo(false);
      setNeedsLanguageSelection(false);
      setUser(null);
      setToken(null);
      localStorage.removeItem('enterseed_token');
      sessionStorage.removeItem('enterseed_token');
    }
  };

  const updateLanguagePreference = async (lang: Language) => {
    setLanguage(lang);
    setNeedsLanguageSelection(false);
    if (!user) return;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await apiFetch('/api/auth/language', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ language: lang })
      });
      if (res.ok) {
        setUser((prev) => prev ? { ...prev, preferredLanguage: lang } : null);
      }
    } catch {
      // local preference updated anyway
    }
  };

  const exportUserData = async () => {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await apiFetch('/api/user/export-data', { headers });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Could not export your data.'); }
      const data = await res.json();
      try {
        const localDraft = localStorage.getItem(`enterseed_marketing_draft:${isDemo ? 'demo' : 'account'}:${user?.email || 'guest'}`);
        if (localDraft) data.marketingDraft = JSON.parse(localDraft);
      } catch { /* Export the server data even when local storage is unavailable. */ }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enterseed-data-export-${user?.id || 'me'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      throw new Error(err.message || 'Could not export data.');
    }
  };

  const deleteUserData = async (): Promise<boolean> => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await apiFetch('/api/user/delete-data', { method: 'DELETE', headers });
      if (!res.ok) return false;
      localStorage.removeItem(`enterseed_marketing_draft:${isDemo ? 'demo' : 'account'}:${user?.email || 'guest'}`);
      endDemoSession();
      localStorage.removeItem('enterseed_token');
      sessionStorage.removeItem('enterseed_token');
      setUser(null);
      setToken(null);
      setIsDemo(false);
      setNeedsLanguageSelection(false);
      return true;
    } catch {
      return false;
    }
  };

  const setQuickDemoUser = (demoUser: User) => {
    startDemoSession(demoUser);
    setUser({ ...demoUser, role: 'owner' });
    setToken(null);
    setIsDemo(true);
    setLoading(false);
    setNeedsLanguageSelection(false);
    if (demoUser.preferredLanguage) setLanguage(demoUser.preferredLanguage as Language);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isDemo,
        needsLanguageSelection,
        setNeedsLanguageSelection,
        login,
        register,
        logout,
        updateLanguagePreference,
        exportUserData,
        deleteUserData,
        setQuickDemoUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
