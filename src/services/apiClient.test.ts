import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { apiFetch, startDemoSession, endDemoSession } from './apiClient';

class MemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  clear() { this.data.clear(); }
}
const profile = (email: string) => ({ email, firstName: 'Preview', lastName: 'Owner', business: 'Sample business' });
beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('sessionStorage', new MemoryStorage());
  vi.stubEnv('VITE_DEMO_MODE', 'false');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('an unavailable backend never turns an arbitrary password into a successful login', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  const result = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'unknown@example.com', password: 'wrong' }) });
  expect(result.status).toBe(503);
  expect((await result.json()).user).toBeUndefined();
});
test('a server HTML response is an error rather than simulated success', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Not found</html>', { status: 404, headers: { 'Content-Type': 'text/html' } })));
  expect((await apiFetch('/api/finance/workspace')).status).toBe(404);
});
test('demo financial records are isolated by profile and persist for the original profile', async () => {
  startDemoSession(profile('first@example.com'));
  await apiFetch('/api/finance/assessment', { method: 'PUT', body: JSON.stringify({ monthlyIncome: 123456 }) });
  endDemoSession(); startDemoSession(profile('second@example.com'));
  expect((await (await apiFetch('/api/finance/assessment')).json()).assessment).toBeNull();
  endDemoSession(); startDemoSession(profile('first@example.com'));
  expect((await (await apiFetch('/api/finance/assessment')).json()).assessment.monthlyIncome).toBe(123456);
});
test('demo never submits a supplier message or grants staff access', async () => {
  startDemoSession(profile('preview@example.com'));
  expect((await apiFetch('/api/suppliers/1/messages', { method: 'POST', body: '{}' })).status).toBe(409);
  expect((await apiFetch('/api/admin/inquiries')).status).toBe(403);
});
test('starting a demo discards real bearer tokens and never contacts the server', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('enterseed_token', 'real-session');
  startDemoSession(profile('preview@example.com'));
  await apiFetch('/api/auth/me');
  expect(localStorage.getItem('enterseed_token')).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
test('demo deletion clears only the active profile records', async () => {
  startDemoSession(profile('other@example.com'));
  await apiFetch('/api/registration/draft', { method: 'PUT', body: JSON.stringify({ draft: { businessName: 'Other' } }) });
  startDemoSession(profile('deleted@example.com'));
  await apiFetch('/api/registration/draft', { method: 'PUT', body: JSON.stringify({ draft: { businessName: 'Deleted' } }) });
  await apiFetch('/api/user/delete-data', { method: 'DELETE' });
  startDemoSession(profile('other@example.com'));
  expect((await (await apiFetch('/api/registration/draft')).json()).draft.businessName).toBe('Other');
});
