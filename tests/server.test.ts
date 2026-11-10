import { afterAll, beforeAll, expect, test } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

let child: ChildProcess;
let base: string;
let tokenA: string;
let tokenB: string;
let ticketId: number;
let documentId: number;
const directory = mkdtempSync(path.join(tmpdir(), 'enterseed-regression-'));
const headers = (token?: string) => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
const request = (endpoint: string, token?: string, method = 'GET', body?: unknown) => fetch(`${base}${endpoint}`, { method, headers: headers(token), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
beforeAll(async () => {
  const listener = net.createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = (listener.address() as net.AddressInfo).port;
  await new Promise<void>(resolve => listener.close(() => resolve()));
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', DATABASE_PATH: path.join(directory, 'test.sqlite'), PORT: String(port), GEMINI_API_KEY: '', RESEND_API_KEY: '', FRONTEND_ORIGINS: 'https://preview.example' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let logs = '';
  child.stdout?.on('data', data => { logs += data; }); child.stderr?.on('data', data => { logs += data; });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await request('/api/health')).ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error(`Server did not become ready: ${logs}`);
  for (const owner of ['a', 'b']) {
    const response = await request('/api/auth/register', undefined, 'POST', { email: `${owner}@example.test`, password: 'Review-password-123!', firstName: owner.toUpperCase(), lastName: 'Owner', business: `Business ${owner}`, municipality: 'Tupi', agree: true });
    const result = await response.json();
    expect(response.status).toBe(201);
    if (owner === 'a') tokenA = result.sessionToken; else tokenB = result.sessionToken;
  }
}, 25000);
afterAll(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await exited;
  }
  rmSync(directory, { recursive: true, force: true });
});

test('production boots and personal endpoints reject unauthenticated requests', async () => {
  for (const endpoint of ['/api/finance/assessment', '/api/finance/workspace', '/api/registration/draft', '/api/efiling/tickets', '/api/ai/documents', '/api/suppliers/messages']) {
    expect((await request(endpoint)).status).toBe(401);
  }
  expect((await request('/api/suppliers')).status).toBe(200);
  expect((await (await request('/api/suppliers')).json()).suppliers).toEqual([]);
});
test('finance persists per account and rejects malformed or negative values', async () => {
  const workspace = { openingBalance: 12500, transactions: [{ id: 'sale-1', type: 'in', category: 'Sales', description: 'First sale', amount: 500, date: '2026-11-10' }], debts: [], taxChecklist: {}, investA: { name: 'A', cost: 0, monthlyBenefit: 0, usefulLifeMonths: 12 }, investB: { name: 'B', cost: 0, monthlyBenefit: 0, usefulLifeMonths: 12 } };
  expect((await request('/api/finance/workspace', tokenA, 'PUT', { workspace })).status).toBe(200);
  expect((await (await request('/api/finance/workspace', tokenA)).json()).workspace).toEqual(workspace);
  expect((await (await request('/api/finance/workspace', tokenB)).json()).workspace).toBeNull();
  expect((await request('/api/finance/workspace', tokenA, 'PUT', { workspace: { ...workspace, openingBalance: -10 } })).status).toBe(400);
});
test('registration drafts and tickets never cross account boundaries', async () => {
  const draft = { businessName: 'Private business', tinNumber: '' };
  expect((await request('/api/registration/draft', tokenA, 'PUT', { draft })).status).toBe(200);
  expect((await (await request('/api/registration/draft', tokenB)).json()).draft).toBeNull();
  const response = await request('/api/efiling/tickets', tokenA, 'POST', { businessName: 'Private business', businessType: 'Sole Proprietorship', municipality: 'Tupi', filingStage: 'Business Name', documents: ['checklist.pdf'] });
  expect(response.status).toBe(201);
  ticketId = (await response.json()).ticket.id;
  expect((await (await request('/api/efiling/tickets', tokenB)).json()).tickets).toEqual([]);
  expect((await request(`/api/efiling/tickets/${ticketId}`, tokenB, 'PATCH', { notes: 'Changed by another owner' })).status).toBe(404);
  await request(`/api/efiling/tickets/${ticketId}`, tokenB, 'DELETE');
  expect((await (await request('/api/efiling/tickets', tokenA)).json()).tickets[0].documents).toEqual(['checklist.pdf']);
});
test('document save accepts the client payload and scopes list/detail to the owner', async () => {
  const doc = { docType: 'business_plan', title: 'Private plan', businessName: 'Business A', municipality: 'Tupi', contentHtml: '<h1>Private plan</h1><p>Owner A content</p>', summary: { projectedRevenue: 12000 } };
  const response = await request('/api/ai/save-doc', tokenA, 'POST', { doc });
  expect(response.status).toBe(201);
  documentId = (await response.json()).document.id;
  expect((await request(`/api/ai/documents/${documentId}`, tokenB)).status).toBe(404);
  expect((await (await request('/api/ai/documents', tokenB)).json()).documents).toEqual([]);
  const saved = (await (await request('/api/ai/documents', tokenA)).json()).documents[0];
  expect(saved.summary.projectedRevenue).toBe(12000);
  expect((await request('/api/ai/save-doc', tokenA, 'POST', { doc: { ...doc, id: documentId, contentHtml: '<p>Updated private plan</p>' } })).status).toBe(200);
  expect((await (await request('/api/ai/documents', tokenA)).json()).documents).toHaveLength(1);
});
test('local document drafts do not invent profits, payback, or government endorsements', async () => {
  const response = await request('/api/ai/generate-doc', tokenA, 'POST', { docType: 'business_plan', businessName: 'Business A', municipality: 'Tupi', sector: 'Retail', targetMarket: 'Local households', monthlyRevenue: 1000, requestedAmount: 5000, supplyChainNotes: 'Local suppliers', saveToLibrary: false });
  expect(response.ok).toBe(true);
  const { document } = await response.json();
  expect(document.summary.projectedRevenue).toBe(12000);
  expect(document.summary.paybackMonths).toBe(0);
  expect(document.contentHtml).toContain('Profit and payback cannot be calculated from sales alone');
});
test('unknown API routes return an explicit JSON error', async () => {
  const response = await request('/api/does-not-exist');
  expect(response.status).toBe(404);
  expect(response.headers.get('Content-Type')).toContain('application/json');
});
test('unknown suppliers return a useful error rather than a failed database insert', async () => {
  expect((await request('/api/suppliers/99999/messages', tokenA, 'POST', { subject: 'Quotation', message: 'Please share a quotation.' })).status).toBe(404);
});
test('configured cross-origin clients receive valid preflight headers', async () => {
  const response = await fetch(`${base}/api/auth/login`, { method: 'OPTIONS', headers: { Origin: 'https://preview.example', 'Access-Control-Request-Method': 'POST' } });
  expect(response.status).toBe(204);
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://preview.example');
});
test('account deletion removes its workspace without affecting other accounts', async () => {
  expect((await request('/api/user/delete-data', tokenA, 'DELETE')).status).toBe(200);
  expect((await request('/api/auth/me', tokenA)).status).toBe(401);
  expect((await request('/api/auth/me', tokenB)).status).toBe(200);
});
