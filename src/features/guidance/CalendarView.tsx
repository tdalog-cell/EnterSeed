import React, { useEffect, useState } from 'react';
import { Button, Panel, PanelHeader, PageHeader, inputClass } from '../../components/ui';
import { Fields, SaveForm, Command, LoadState, useResource, useCopy, guidance } from './shared';
import { manilaDay, reminderState, daySchema } from '../../domain/guidance';
import { apiFetch } from '../../services/apiClient';

export function CalendarView() {
  const c = useCopy(), resource = useResource('/overview');
  const blank = { title:'',date:manilaDay(),category:'custom',completed:false,actionId:null,opportunityId:null,debtId:'' };
  const [form,setForm] = useState<any>(()=>({ ...blank, actionId:Number(sessionStorage.getItem('enterseed-reminder-action')) || null }));
  const [month,setMonth] = useState(manilaDay().slice(0,7)),[filter,setFilter] = useState('all'),[debts,setDebts] = useState<any[]>([]);
  useEffect(()=>{sessionStorage.removeItem('enterseed-reminder-action'); apiFetch('/api/finance/workspace').then(r=>r.ok?r.json():Promise.reject()).then(d=>setDebts(d.workspace?.debts || [])).catch(()=>{});},[]);
  if(!resource.data) return <LoadState resource={resource} />;
  const reminders = resource.data.reminders.sort((a:any,b:any)=>a.date.localeCompare(b.date));
  const first = new Date(`${month}-01T00:00:00Z`), days = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const shift = (offset:number) => { const d = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+offset,1)); setMonth(d.toISOString().slice(0,7)); };
  return <div className="space-y-6"><PageHeader title={c('Business calendar')} lead={c('Your dates and follow-ups, in Asia/Manila. Confirm official deadlines with the relevant agency.')} /><LoadState resource={resource} />
    <Panel><PanelHeader title={c(form.id ? 'Edit reminder' : 'Create reminder')} />
    <SaveForm label="Save reminder" onSave={async()=>{ await guidance(`/reminders${form.id?`/${form.id}`:''}`,form.id?'PUT':'POST',form); setForm(blank); await resource.reload(); }}>
      <Fields fields={[{key:'title',label:'Reminder title'},{key:'date',label:'Due date',type:'date'},{key:'category',label:'Category',options:['loan','permit','registration','supplier','follow_up','opportunity','custom']}]} value={form} setValue={setForm} />
      <label className="block text-sm">{c('Related action')}<select className={inputClass} value={form.actionId || ''} onChange={e=>setForm({...form,actionId:Number(e.target.value)||null})}><option value="">{c('None')}</option>{resource.data.actions.map((a:any)=><option key={a.id} value={a.id}>{c(a.title)}</option>)}</select></label>
      <label className="flex gap-2"><input type="checkbox" checked={form.completed} onChange={e=>setForm({...form,completed:e.target.checked})} />{c('Completed')}</label>
      {form.id && <Button variant="ghost" onClick={()=>setForm(blank)}>{c('Cancel editing')}</Button>}
    </SaveForm></Panel>
    {debts.length>0 && <Panel><PanelHeader title={c('Link a recorded loan payment')} />{debts.map(d=><div key={d.id} className="flex flex-wrap gap-3 py-2"><span>{d.lender} · {d.dueDate}</span><Button variant="secondary" size="sm" onClick={()=>setForm({...blank,title:d.lender,date:daySchema.safeParse(d.dueDate).success?d.dueDate:manilaDay(),category:'loan',debtId:d.id})}>{c('Prepare reminder')}</Button></div>)}</Panel>}
    <Panel><div className="flex justify-between items-center gap-2 mb-4"><Button variant="secondary" onClick={()=>shift(-1)} aria-label={c('Previous month')}>←</Button><h2 className="font-semibold">{first.toLocaleDateString('en-PH',{month:'long',year:'numeric',timeZone:'UTC'})}</h2><Button variant="secondary" onClick={()=>shift(1)} aria-label={c('Next month')}>→</Button></div>
      <div className="grid grid-cols-7 text-center text-xs gap-1">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><span key={d}>{c(d)}</span>)}{Array.from({length:first.getUTCDay()},(_,i)=><span key={`blank${i}`} />)}{Array.from({length:days},(_,i)=>{ const date=`${month}-${String(i+1).padStart(2,'0')}`,count=reminders.filter((r:any)=>r.date===date&&!r.completed).length; return <button key={date} onClick={()=>setForm({...blank,date})} aria-label={`${date}: ${count} ${c('reminders')}`} className={`rounded-lg border p-2 min-h-14 ${date===manilaDay()?'border-brand bg-brand-soft':'border-line'}`}><span>{i+1}</span>{count>0&&<span className="block rounded-full bg-highlight-soft text-highlight-ink">{count}</span>}</button>; })}</div>
    </Panel>
    <Panel><PanelHeader title={c('Reminder list')} /><label>{c('Filter reminders')}<select className={inputClass} value={filter} onChange={e=>setFilter(e.target.value)}>{['all','overdue','today','upcoming','completed'].map(v=><option key={v} value={v}>{c(v)}</option>)}</select></label>
      {!reminders.length&&<p className="py-5">{c('No reminders yet. Create your first business reminder above.')}</p>}
      {reminders.filter((r:any)=>filter==='all'||reminderState(r)===filter).map((r:any)=><article key={r.id} className="border-t border-line py-4 mt-3"><h3 className="font-semibold">{r.title}</h3><p className="text-sm mb-3">{r.date} · {c(r.category)} · <strong>{c(reminderState(r))}</strong></p><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={()=>{setForm(r);window.scrollTo({top:0,behavior:'smooth'});}}>{c('Edit / reschedule')}</Button><Command run={async()=>{await guidance(`/reminders/${r.id}`,'PUT',{...r,completed:!r.completed});await resource.reload();}}>{c(r.completed?'Reopen':'Complete')}</Command><Command variant="danger" run={async()=>{if(window.confirm(c('Delete this reminder?'))){await guidance(`/reminders/${r.id}`,'DELETE');await resource.reload();}}}>{c('Delete')}</Command></div></article>)}
    </Panel></div>;
}
