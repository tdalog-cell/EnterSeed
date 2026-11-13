import { test, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { migrateGuidance } from '../server/guidance';

test('additive migration can rerun without changing existing users or saved actions',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT); INSERT INTO users VALUES(1,'Existing owner');");
  migrateGuidance(db);
  db.prepare('INSERT INTO business_profiles(user_id,data) VALUES(?,?)').run(1,JSON.stringify({businessName:'Existing business'}));
  migrateGuidance(db);
  expect(db.prepare('SELECT name FROM users WHERE id=1').get()?.name).toBe('Existing owner');
  expect(db.prepare('SELECT COUNT(*) AS n FROM business_profiles').get()?.n).toBe(1);
  expect(db.prepare('SELECT COUNT(*) AS n FROM guidance_migrations').get()?.n).toBe(1);
  expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  expect(db.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
  db.close();
});
