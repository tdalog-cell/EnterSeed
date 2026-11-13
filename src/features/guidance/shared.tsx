import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../services/apiClient';
import { useLanguage } from '../../context/LanguageContext';
import { Button, Field, Notice, inputClass } from '../../components/ui';

export async function guidance(path: string, method = 'GET', body?: unknown) {
  const response = await apiFetch(`/api/guidance${path}`, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (response.status === 204) return {};
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.issues ? data.issues.map((i: any) => `${i.field}: ${i.message}`).join('; ') : data.error || `Request failed (${response.status})`);
  return data;
}
export const copyKey = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '_');
export function useCopy() {
  const { t } = useLanguage();
  return (value: string) => { const key = copyKey(value); const translated = t(`guidance.${key}`); return translated === key ? value : translated; };
}
export function useResource(path: string) {
  const [data,setData] = useState<any>(null), [error,setError] = useState(''), [loading,setLoading] = useState(true);
  const reload = useCallback(async () => { setLoading(true); try { setData(await guidance(path)); setError(''); } catch(e) { setError((e as Error).message); } finally { setLoading(false); } },[path]);
  useEffect(() => { void reload(); },[reload]);
  return { data,error,loading,reload };
}
export function LoadState({ resource }: { resource: ReturnType<typeof useResource> }) {
  const c = useCopy();
  return resource.error ? <Notice tone="error">{c('Unable to load your records. Please retry.')} <Button variant="secondary" onClick={resource.reload}>{c('Retry')}</Button></Notice> : resource.loading ? <p role="status">{c('Loading your workspace…')}</p> : null;
}
export type FormField = { key: string; label: string; type?: string; options?: string[] | { value: string; label: string }[]; optional?: boolean; min?: number; max?: number; step?: string };
export function Fields({ fields, value, setValue }: { fields: FormField[]; value: any; setValue: (v: any) => void }) {
  const c = useCopy();
  return <div className="grid gap-4 sm:grid-cols-2">{fields.map(f => <Field key={f.key} label={c(f.label)}>{id => {
    const props = { id, className: inputClass, required: !f.optional, value: value[f.key] ?? '', onChange: (e: any) => setValue({ ...value,[f.key]: f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }) };
    return f.options ? <select {...props}>{f.optional && <option value="">{c('None')}</option>}{f.options.map(o => { const v = typeof o === 'string' ? o : o.value; return <option key={v} value={v}>{c(typeof o === 'string' ? o : o.label)}</option>; })}</select> : f.type === 'textarea' ? <textarea {...props} rows={3} maxLength={5000} /> : <input {...props} type={f.type || 'text'} min={f.min ?? (f.type === 'number' ? 0 : undefined)} max={f.max} step={f.step || (f.type === 'number' ? 'any' : undefined)} maxLength={f.type === 'text' || !f.type ? 200 : undefined} />;
  }}</Field>)}</div>;
}
export function SaveForm({ children, onSave, label = 'Save changes' }: { children: React.ReactNode; onSave: () => Promise<void>; label?: string }) {
  const c = useCopy();
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [saved,setSaved] = useState(false);
  return <form className="space-y-4" onChange={() => setSaved(false)} onSubmit={async e => { e.preventDefault(); if(busy) return; setBusy(true); setError(''); setSaved(false); try { await onSave(); setSaved(true); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }}>
    <fieldset disabled={busy} className="space-y-4">{children}</fieldset>
    {error && <Notice tone="error">{c('Could not save. Check your entries and try again.')} <span>{error}</span></Notice>}
    {saved && <Notice tone="success">{c('Saved to your account.')}</Notice>}
    <Button type="submit" busy={busy} busyLabel={c('Saving…')}>{c(label)}</Button>
  </form>;
}
export function Command({ run, children, variant = 'secondary' }: { run: () => Promise<unknown>; children: React.ReactNode; variant?: 'secondary' | 'danger' }) {
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  return <span className="inline-flex flex-col items-start gap-1"><Button size="sm" variant={variant} busy={busy} onClick={async()=>{ setBusy(true); setError(''); try { await run(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); } }}>{children}</Button>{error && <span role="alert" className="text-danger text-xs">{error}</span>}</span>;
}
export const navigate = (page: string) => window.dispatchEvent(new CustomEvent('navigate-tab',{ detail: page }));
export const pesos = (n: number) => new Intl.NumberFormat('en-PH',{ style:'currency',currency:'PHP',minimumFractionDigits:2 }).format(n);
