import { DatabaseSync } from 'node:sqlite';
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


let actionId: number;
let reminderId: number;
let caseId: number;
let opportunityId: number;
const profile = { businessName:'Test bakery',sector:'Food',stage:'operating',size:'micro',location:'Tupi',products:'Bread',goal:'profit',challenges:'',language:'en' };
const get = async (p: string,t=tokenA) => (await request('/api/guidance'+p,t)).json();
const send = (p: string,body: unknown,method='POST',t=tokenA) => request('/api/guidance'+p,t,method,body);

test('guidance requires authentication and rejects owner access to all staff routes',async()=>{
  expect((await request('/api/guidance/overview')).status).toBe(401);
  for(const p of ['/staff/support','/staff/opportunities','/staff/metrics']) expect((await request('/api/guidance'+p,tokenA)).status).toBe(403);
});
test('profile creates three persistent actions; goal changes preserve completed history',async()=>{
  expect((await send('/profile',profile,'PUT')).ok).toBe(true);
  let d=await get('/overview');expect(d.actions).toHaveLength(3);actionId=d.actions[0].id;
  expect((await send(`/actions/${actionId}`,{title:'Calculate product costs',status:'completed'},'PATCH')).ok).toBe(true);
  await send('/profile',{...profile,goal:'funding'},'PUT');d=await get('/overview');
  expect(d.actions.filter((a:any)=>a.active)).toHaveLength(3);
  expect(d.actions.find((a:any)=>a.id===actionId).status).toBe('completed');
  expect(d.actions.find((a:any)=>a.id===actionId).active).toBe(false);
  await send('/profile',profile,'PUT'); d=await get('/overview');
  expect(d.actions.filter((a:any)=>a.active)).toHaveLength(3);
  expect(d.actions.find((a:any)=>a.id===actionId).status).toBe('completed');
  expect((await get('/overview',tokenB)).profile).toBeNull();
  expect((await send(`/actions/${actionId}`,{title:'No',status:'completed'},'PATCH',tokenB)).status).toBe(404);
});
test('reminders validate dates, linked ownership, rescheduling and deletion',async()=>{
  const r={title:'Payment',date:'2026-12-01',category:'loan',actionId};
  expect((await send('/reminders',{...r,date:'2026-02-30'})).status).toBe(400);
  expect((await send('/reminders',r,'POST',tokenB)).status).toBe(400);
  expect((await send('/reminders',r)).ok).toBe(true);
  reminderId=(await get('/overview')).reminders[0].id;
  expect((await send(`/reminders/${reminderId}`,r,'PUT',tokenB)).status).toBe(404);
  expect((await send(`/reminders/${reminderId}`,{...r,date:'2026-12-05',completed:true},'PUT')).ok).toBe(true);
  expect((await get('/overview')).reminders[0]).toMatchObject({date:'2026-12-05',completed:true});
});
test('support ownership, staff assignment and private notes are enforced on the server',async()=>{
  const created=await send('/support',{title:'Help with costs',category:'finance',message:'Please review my costing process.'});caseId=(await created.json()).id;
  expect((await request(`/api/guidance/support/${caseId}`,tokenB)).status).toBe(404);
  expect((await send(`/support/${caseId}/replies`,{message:'Hide this',internal:true})).status).toBe(403);
  const db=new DatabaseSync(path.join(directory,'test.sqlite'));
  db.prepare("UPDATE users SET role='staff' WHERE email='b@example.test'").run();db.close();
  const members=await get('/staff/support',tokenB);
  expect((await send(`/staff/support/${caseId}`,{status:'assigned',assignee:members.staff[0].id,followUp:'2026-12-02'},'PATCH',tokenB)).ok).toBe(true);
  await send(`/support/${caseId}/replies`,{message:'Private staff reasoning',internal:true},'POST',tokenB);
  await send(`/support/${caseId}/replies`,{message:'We can help with your costs.',internal:false},'POST',tokenB);
  const owner=await get(`/support/${caseId}`); expect(owner.item.status).toBe('assigned');
  expect(JSON.stringify(owner)).not.toContain('Private staff reasoning');
  expect((await get(`/support/${caseId}`,tokenB)).replies).toHaveLength(3);
  const exported=await (await request('/api/user/export-data',tokenA)).json();
  expect(JSON.stringify(exported)).not.toContain('Private staff reasoning');
});
test('review controls prevent fabricated publication metadata and support saved deadlines',async()=>{
  const opportunity={name:'Test-only opportunity',provider:'Test provider',description:'Synthetic test fixture, never production data.',sourceUrl:'https://example.test/program',eligibility:'Test requirements',location:'Tupi',sector:'Food',stage:'operating',deadline:'2099-01-01',procedure:'Test procedure',verifiedDate:'',verification:'draft',published:true};
  expect((await send('/staff/opportunities',opportunity,'POST',tokenA)).status).toBe(403);
  expect((await send('/staff/opportunities',opportunity,'POST',tokenB)).status).toBe(400);
  const body={...opportunity,verifiedDate:'2026-01-01',verification:'reviewed'};
  const saved=await send('/staff/opportunities',body,'POST',tokenB);opportunityId=(await saved.json()).id;
  expect((await get('/opportunities')).entries).toHaveLength(1);
  await send(`/opportunities/${opportunityId}/save`,{});
  await send(`/opportunities/${opportunityId}/save`,{});
  expect((await get('/overview')).saved).toHaveLength(1);
  expect((await send('/reminders',{title:body.name,date:body.deadline,category:'opportunity',opportunityId})).ok).toBe(true);
  await send(`/staff/opportunities/${opportunityId}`,{...body,published:false},'PUT',tokenB);
  expect((await get('/opportunities')).entries).toHaveLength(0);
  expect((await get('/overview')).saved[0].published).toBe(false);
});
test('costing and quotation scenarios persist privately; invalid formulas fail validation',async()=>{
  const cost={name:'Bread',materials:100,labor:0,packaging:0,transport:0,other:0,fixedFees:0,feePercent:10,units:10,target:20,mode:'margin'};
  const result=await send('/worksheets/costing',cost); const id=(await result.json()).id;
  expect((await get('/worksheets/costing')).entries[0].materials).toBe(100);
  expect((await get('/worksheets/costing',tokenB)).entries).toEqual([]);
  expect((await send(`/worksheets/costing/${id}`,cost,'PUT',tokenB)).status).toBe(404);
  expect((await send('/worksheets/costing',{...cost,units:0})).status).toBe(400);
  expect((await send('/worksheets/costing',{...cost,target:90})).status).toBe(400);
  const quote={supplier:'Test',product:'Bags',price:2,minimum:10,delivery:20,charges:0,leadDays:2,terms:'Cash'};
  expect((await send('/worksheets/quotations',{name:'Bags',quantity:20,quotes:[quote,{...quote,supplier:'Second'}]})).ok).toBe(true);
  expect((await get('/worksheets/quotations')).entries).toHaveLength(1);
});
test('metrics exclude staff, expose definitions-compatible aggregates, and avoid business content',async()=>{
  const metrics=await get('/staff/metrics',tokenB);
  expect(metrics.usefulAccounts).toBe(1);expect(metrics.activeAccounts).toBe(1);
  expect(metrics.response.responded).toBe(1);
  expect(JSON.stringify(metrics)).not.toContain('Test bakery');
  expect(metrics.counts.find((v:any)=>v.name==='opportunity_saved').events).toBe(1);
});
test('export and account deletion cover all new private records and preserve staff catalog',async()=>{
  const data=await (await request('/api/user/export-data',tokenA)).json();expect(data.guidance.businessProfile.businessName).toBe('Test bakery');expect(data.guidance.worksheets).toHaveLength(2);
  expect((await request('/api/user/delete-data',tokenA,'DELETE')).ok).toBe(true);
  const db=new DatabaseSync(path.join(directory,'test.sqlite'));
  for(const table of ['business_profiles','business_actions','business_reminders','support_cases','support_replies','business_worksheets','saved_opportunities','useful_events'])expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n).toBe(0);
  expect(db.prepare('SELECT COUNT(*) AS n FROM opportunities').get()?.n).toBe(1);db.close();
});
