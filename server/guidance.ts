import { Router, type RequestHandler } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { profileSchema, actionSchema, reminderSchema, opportunitySchema, supportSchema, supportUpdateSchema, replySchema, costingSchema, comparisonSchema, recommend, manilaDay } from '../src/domain/guidance';

export function migrateGuidance(db: DatabaseSync) {
  db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS guidance_migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS business_profiles (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS business_actions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, template TEXT NOT NULL, data TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, UNIQUE(user_id,template));
    CREATE TABLE IF NOT EXISTS opportunities (id INTEGER PRIMARY KEY, data TEXT NOT NULL, reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS saved_opportunities (user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE CASCADE, PRIMARY KEY(user_id,opportunity_id));
    CREATE TABLE IF NOT EXISTS business_reminders (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS support_cases (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted', assignee INTEGER REFERENCES users(id) ON DELETE SET NULL, follow_up TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, first_response_at TEXT);
    CREATE TABLE IF NOT EXISTS support_replies (id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE, author_id INTEGER REFERENCES users(id) ON DELETE SET NULL, message TEXT NOT NULL, internal INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS business_worksheets (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS useful_events (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, entity TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS guidance_audit (id INTEGER PRIMARY KEY, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, entity TEXT NOT NULL, entity_id INTEGER NOT NULL, operation TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS reminders_owner ON business_reminders(user_id);
    CREATE INDEX IF NOT EXISTS worksheets_owner ON business_worksheets(user_id,kind);
    CREATE INDEX IF NOT EXISTS support_owner ON support_cases(user_id,status);
    CREATE INDEX IF NOT EXISTS support_followup ON support_cases(status,follow_up);
    CREATE INDEX IF NOT EXISTS replies_case ON support_replies(case_id,internal);
    CREATE INDEX IF NOT EXISTS events_week ON useful_events(created_at,user_id);
    INSERT OR IGNORE INTO guidance_migrations(version) VALUES(1);
    COMMIT;`);
}
const decode = (row: any) => row ? { ...JSON.parse(row.data), id: row.id, ...(row.active !== undefined ? { active: !!row.active } : {}) } : null;
export function exportGuidance(db: DatabaseSync, userId: number) {
  const records = (table: string) => db.prepare(`SELECT * FROM ${table} WHERE user_id=?`).all(userId);
  return {
    businessProfile: decode(db.prepare('SELECT data FROM business_profiles WHERE user_id=?').get(userId)),
    actions: records('business_actions').map(decode), reminders: records('business_reminders').map(decode),
    worksheets: records('business_worksheets').map((r: any) => ({ ...decode(r), kind: r.kind })),
    savedOpportunities: records('saved_opportunities'), supportCases: records('support_cases'),
    replies: db.prepare('SELECT r.id,r.case_id,r.message,r.created_at FROM support_replies r JOIN support_cases c ON c.id=r.case_id WHERE c.user_id=? AND r.internal=0').all(userId), events: records('useful_events')
  };
}
export function guidanceRouter(db: DatabaseSync, authenticate: RequestHandler) {
  const router = Router();
  router.use(authenticate);
  const staff = (req: any) => ['staff', 'admin'].includes(req.account.role);
  const staffOnly: RequestHandler = (req, res, next) => staff(req) ? next() : void res.status(403).json({ error: 'Staff access required.' });
  const event = (user: number, name: string, entity: string | number) => db.prepare('INSERT INTO useful_events(user_id,name,entity) VALUES(?,?,?)').run(user, name, String(entity));
  const audit = (user: number, entity: string, id: number, op: string) => db.prepare('INSERT INTO guidance_audit(actor_id,entity,entity_id,operation) VALUES(?,?,?,?)').run(user, entity, id, op);
  const transaction = (fn: () => void) => { db.exec('BEGIN IMMEDIATE'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const owned = (table: string, id: number, user: number) => db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).get(id, user) as any;
  const parse = (schema: z.ZodType, req: any, res: any): any => {
    const result = schema.safeParse(req.body);
    if (!result.success) { res.status(400).json({ error: 'Please check the highlighted fields.', issues: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) }); return null; }
    return result.data;
  };
  router.get('/overview', (req: any, res) => {
    const user = req.account.id;
    const profile = decode(db.prepare('SELECT data FROM business_profiles WHERE user_id=?').get(user));
    const actions = db.prepare('SELECT * FROM business_actions WHERE user_id=? ORDER BY active DESC,id').all(user).map(decode);
    const reminders = db.prepare('SELECT * FROM business_reminders WHERE user_id=?').all(user).map(decode);
    const saved = db.prepare('SELECT o.* FROM opportunities o JOIN saved_opportunities s ON o.id=s.opportunity_id WHERE s.user_id=?').all(user).map(decode);
    const cases = db.prepare('SELECT * FROM support_cases WHERE user_id=? ORDER BY id DESC').all(user);
    res.json({ profile, actions, reminders, saved, cases });
  });
  router.put('/profile', (req: any, res) => {
    const data = parse(profileSchema, req, res); if (!data) return;
    const user = req.account.id;
    transaction(() => {
      db.prepare('INSERT INTO business_profiles(user_id,data) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data').run(user, JSON.stringify(data));
      db.prepare('UPDATE users SET business_name=?,municipality=?,preferred_language=? WHERE id=?').run(data.businessName,data.location,data.language,user);
      db.prepare('UPDATE business_actions SET active=0 WHERE user_id=?').run(user);
      for (const item of recommend(data)) {
        const existing: any = db.prepare('SELECT * FROM business_actions WHERE user_id=? AND template=?').get(user, item.key);
        if (existing) db.prepare('UPDATE business_actions SET active=1,data=? WHERE id=?').run(JSON.stringify({ ...decode(existing), priority:item.priority,reason:item.reason }),existing.id);
        else db.prepare('INSERT INTO business_actions(user_id,template,data) VALUES(?,?,?)').run(user,item.key,JSON.stringify({ ...item, status: 'not_started', dismissed: false }));
      }
      event(user,'profile_saved','profile');
    });
    res.json({ success: true });
  });
  router.patch('/actions/:id', (req: any, res) => {
    const row = owned('business_actions',Number(req.params.id),req.account.id); if (!row) return res.sendStatus(404);
    const input = parse(actionSchema,req,res); if (!input) return;
    const old = decode(row);
    transaction(() => {
      db.prepare('UPDATE business_actions SET data=? WHERE id=?').run(JSON.stringify({ ...old,...input }),row.id);
      if (input.status === 'completed' && old.status !== 'completed') event(req.account.id,'action_completed',row.id);
    });
    res.json({ success: true });
  });
  router.post('/reminders', saveReminder);
  router.put('/reminders/:id', saveReminder);
  function saveReminder(req: any, res: any) {
    const data = parse(reminderSchema,req,res); if (!data) return;
    const user = req.account.id, id = Number(req.params.id);
    if (id && !owned('business_reminders',id,user)) return res.sendStatus(404);
    if (data.actionId && !owned('business_actions',data.actionId,user)) return res.status(400).json({ error: 'Choose one of your actions.' });
    if (data.opportunityId && !db.prepare('SELECT 1 FROM saved_opportunities WHERE user_id=? AND opportunity_id=?').get(user,data.opportunityId)) return res.status(400).json({ error: 'Save the opportunity first.' });
    if (data.opportunityId && db.prepare("SELECT 1 FROM business_reminders WHERE user_id=? AND json_extract(data,'$.opportunityId')=? AND json_extract(data,'$.date')=? AND id!=?").get(user,data.opportunityId,data.date,id||0)) return res.status(409).json({ error: 'This opportunity deadline already has a reminder.' });
    if (data.debtId) {
      const workspace: any = db.prepare('SELECT workspace_json FROM finance_workspaces WHERE user_id=?').get(user);
      if (!workspace || !JSON.parse(workspace.workspace_json).debts?.some((d: any) => d.id === data.debtId)) return res.status(400).json({ error: 'Debt record not found.' });
      const duplicate = db.prepare("SELECT id FROM business_reminders WHERE user_id=? AND json_extract(data,'$.debtId')=? AND json_extract(data,'$.date')=? AND id!=?").get(user,data.debtId,data.date,id || 0);
      if (duplicate) return res.status(409).json({ error: 'This payment already has a reminder.' });
    }
    if (id) db.prepare('UPDATE business_reminders SET data=? WHERE id=?').run(JSON.stringify(data),id);
    else { const result = db.prepare('INSERT INTO business_reminders(user_id,data) VALUES(?,?)').run(user,JSON.stringify(data)); event(user,'reminder_created',Number(result.lastInsertRowid)); }
    res.json({ success: true });
  }
  router.delete('/reminders/:id', (req: any,res) => { const result = db.prepare('DELETE FROM business_reminders WHERE id=? AND user_id=?').run(Number(req.params.id),req.account.id); res.sendStatus(result.changes ? 204 : 404); });
  router.get('/opportunities', (req: any,res) => {
    const today = manilaDay();
    const entries = db.prepare('SELECT * FROM opportunities ORDER BY id DESC').all().map(decode).filter(o => o.published && o.verification === 'reviewed' && (!o.deadline || o.deadline >= today));
    res.json({ entries });
  });
  router.post('/opportunities/:id/save', (req: any,res) => {
    const id = Number(req.params.id), o = decode(db.prepare('SELECT * FROM opportunities WHERE id=?').get(id));
    if (!o || !o.published || o.verification !== 'reviewed' || (o.deadline && o.deadline < manilaDay())) return res.sendStatus(404);
    const result = db.prepare('INSERT OR IGNORE INTO saved_opportunities(user_id,opportunity_id) VALUES(?,?)').run(req.account.id,id);
    if (result.changes) event(req.account.id,'opportunity_saved',id);
    res.json({ success: true });
  });
  router.delete('/opportunities/:id/save', (req: any,res) => { db.prepare('DELETE FROM saved_opportunities WHERE user_id=? AND opportunity_id=?').run(req.account.id,Number(req.params.id)); res.sendStatus(204); });
  router.get('/staff/opportunities', staffOnly, (_req,res) => res.json({ entries: db.prepare('SELECT * FROM opportunities ORDER BY id DESC').all().map(decode) }));
  router.post('/staff/opportunities', staffOnly, saveOpportunity);
  router.put('/staff/opportunities/:id', staffOnly, saveOpportunity);
  function saveOpportunity(req: any,res: any) {
    const data = parse(opportunitySchema,req,res); if (!data) return;
    if (data.verifiedDate > manilaDay()) return res.status(400).json({ error: 'Review dates cannot be in the future.' });
    if (data.published && data.deadline && data.deadline < manilaDay()) return res.status(400).json({ error: 'Expired opportunities cannot be published.' });
    let id = Number(req.params.id);
    if (id && !db.prepare('SELECT 1 FROM opportunities WHERE id=?').get(id)) return res.sendStatus(404);
    transaction(() => {
      if (id) db.prepare('UPDATE opportunities SET data=?,reviewer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(data),req.account.id,id);
      else id = Number(db.prepare('INSERT INTO opportunities(data,reviewer_id) VALUES(?,?)').run(JSON.stringify(data),req.account.id).lastInsertRowid);
      audit(req.account.id,'opportunity',id,data.published ? 'published' : 'saved_unpublished');
    });
    res.json({ id });
  }
  router.get('/support', (req: any,res) => res.json({ cases: db.prepare('SELECT * FROM support_cases WHERE user_id=? ORDER BY id DESC').all(req.account.id) }));
  router.post('/support', (req: any,res) => {
    const data = parse(supportSchema,req,res); if (!data) return;
    let id: number;
    transaction(() => {
      id = Number(db.prepare('INSERT INTO support_cases(user_id,title,category) VALUES(?,?,?)').run(req.account.id,data.title,data.category).lastInsertRowid);
      db.prepare('INSERT INTO support_replies(case_id,author_id,message) VALUES(?,?,?)').run(id,req.account.id,data.message);
      event(req.account.id,'support_submitted',id);
    });
    res.status(201).json({ id });
  });
  const canReadCase = (req: any) => staff(req) ? db.prepare('SELECT * FROM support_cases WHERE id=?').get(Number(req.params.id)) : owned('support_cases',Number(req.params.id),req.account.id);
  router.get('/support/:id', (req: any,res) => {
    const item = canReadCase(req); if (!item) return res.sendStatus(404);
    const replies = db.prepare(`SELECT id,message,internal,created_at,author_id FROM support_replies WHERE case_id=? ${staff(req) ? '' : 'AND internal=0'} ORDER BY id`).all(Number(req.params.id));
    res.json({ item,replies });
  });
  router.post('/support/:id/replies', (req: any,res) => {
    const item: any = canReadCase(req); if (!item) return res.sendStatus(404);
    const data = parse(replySchema,req,res); if (!data) return;
    if (data.internal && !staff(req)) return res.sendStatus(403);
    transaction(() => {
      db.prepare('INSERT INTO support_replies(case_id,author_id,message,internal) VALUES(?,?,?,?)').run(item.id,req.account.id,data.message,data.internal ? 1 : 0);
      if (staff(req) && !data.internal && item.user_id !== req.account.id) db.prepare('UPDATE support_cases SET first_response_at=COALESCE(first_response_at,CURRENT_TIMESTAMP) WHERE id=?').run(item.id);
      if (!staff(req) && item.status === 'awaiting_user') db.prepare("UPDATE support_cases SET status='in_progress' WHERE id=?").run(item.id);
    });
    res.status(201).json({ success: true });
  });
  router.get('/staff/support', staffOnly, (_req,res) => res.json({ cases: db.prepare('SELECT * FROM support_cases ORDER BY id DESC').all(), staff: db.prepare("SELECT id,first_name || ' ' || last_name AS name FROM users WHERE role IN ('admin','staff')").all() }));
  router.patch('/staff/support/:id',staffOnly,(req: any,res) => {
    const row: any = db.prepare('SELECT * FROM support_cases WHERE id=?').get(Number(req.params.id)); if (!row) return res.sendStatus(404);
    const data = parse(supportUpdateSchema,req,res); if (!data) return;
    if (data.assignee && !db.prepare("SELECT 1 FROM users WHERE id=? AND role IN ('admin','staff')").get(data.assignee)) return res.status(400).json({ error: 'Select a staff member.' });
    transaction(() => {
      db.prepare('UPDATE support_cases SET status=?,assignee=?,follow_up=? WHERE id=?').run(data.status,data.assignee,data.followUp,row.id);
      audit(req.account.id,'support',row.id,data.status);
      if (data.status === 'resolved' && row.status !== 'resolved') event(row.user_id,'support_resolved',row.id);
    });
    res.json({ success: true });
  });
  router.get('/worksheets/:kind', (req: any,res) => res.json({ entries: db.prepare('SELECT * FROM business_worksheets WHERE user_id=? AND kind=? ORDER BY id DESC').all(req.account.id,req.params.kind).map(decode) }));
  router.post('/worksheets/:kind',saveWorksheet);
  router.put('/worksheets/:kind/:id',saveWorksheet);
  function saveWorksheet(req: any,res: any) {
    const kind = req.params.kind;
    if (!['costing','quotations'].includes(kind)) return res.sendStatus(404);
    const data = parse(kind === 'costing' ? costingSchema : comparisonSchema,req,res); if (!data) return;
    let id = Number(req.params.id);
    const old = id ? owned('business_worksheets',id,req.account.id) : null;
    if (id && (!old || old.kind !== kind)) return res.sendStatus(404);
    if (id) db.prepare('UPDATE business_worksheets SET data=? WHERE id=?').run(JSON.stringify(data),id);
    else { id = Number(db.prepare('INSERT INTO business_worksheets(user_id,kind,data) VALUES(?,?,?)').run(req.account.id,kind,JSON.stringify(data)).lastInsertRowid); event(req.account.id,kind === 'costing' ? 'costing_saved' : 'comparison_saved',id); }
    res.json({ id });
  }
  router.get('/staff/metrics',staffOnly,(_req,res) => {
    const since = new Date(Date.now()-7*86400000).toISOString().replace('T',' ').slice(0,19);
    const counts = db.prepare(`SELECT e.name,COUNT(*) AS events,COUNT(DISTINCT e.user_id) AS accounts FROM useful_events e JOIN users u ON u.id=e.user_id WHERE e.created_at>=? AND u.role='owner' GROUP BY e.name`).all(since);
    const useful: any = db.prepare("SELECT COUNT(DISTINCT e.user_id) AS n FROM useful_events e JOIN users u ON u.id=e.user_id WHERE e.created_at>=? AND u.role='owner' AND e.name IN ('action_completed','costing_saved','comparison_saved')").get(since);
    const active: any = db.prepare("SELECT COUNT(DISTINCT e.user_id) AS n FROM useful_events e JOIN users u ON u.id=e.user_id WHERE e.created_at>=? AND u.role='owner'").get(since);
    const repeat: any = db.prepare("SELECT COUNT(*) AS n FROM (SELECT e.user_id FROM useful_events e JOIN users u ON u.id=e.user_id WHERE e.created_at>=? AND u.role='owner' GROUP BY e.user_id HAVING COUNT(DISTINCT date(e.created_at,'+8 hours'))>=2)").get(since);
    const actions: any = db.prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN json_extract(a.data,'$.status')='completed' THEN 1 ELSE 0 END) AS completed FROM business_actions a JOIN users u ON u.id=a.user_id WHERE u.role='owner' AND a.active=1").get();
    const response: any = db.prepare('SELECT COUNT(*) AS responded,AVG((julianday(first_response_at)-julianday(created_at))*24) AS hours FROM support_cases WHERE first_response_at IS NOT NULL').get();
    res.json({ since, usefulAccounts: useful.n, activeAccounts: active.n, repeatAccounts: repeat.n, actions, response, counts });
  });
  return router;
}
