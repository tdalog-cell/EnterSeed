import { ChevronRight, Clock3, Store, MessageCircle } from '../../components/icons';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Button, Panel, PanelHeader, PageHeader } from '../../components/ui';
import { Fields, SaveForm, LoadState, useResource, useCopy, guidance, navigate, type FormField } from './shared';
import { manilaDay } from '../../domain/guidance';

const fields: FormField[] = [
  { key:'businessName',label:'Business name' }, { key:'sector',label:'Business sector' },
  { key:'stage',label:'Business stage',options:['idea','starting','operating','growing'] },
  { key:'size',label:'Business size',options:['micro','small','medium'] }, { key:'location',label:'Location' },
  { key:'products',label:'Products or services',type:'textarea' },
  { key:'goal',label:'Primary goal',options:[{value:'profit',label:'Improve profitability'},{value:'cash',label:'Improve cash flow'},{value:'customers',label:'Reach customers'},{value:'registration',label:'Prepare registration'},{value:'funding',label:'Find funding'}] },
  { key:'challenges',label:'Current challenges',type:'textarea',optional:true },
  { key:'language',label:'Preferred language',options:[{value:'en',label:'English'},{value:'fil',label:'Filipino'},{value:'ceb',label:'Cebuano'},{value:'hil',label:'Hiligaynon'}] }
];
function ProfileForm({ profile, reload }: any) {
  const { user, refreshUser } = useAuth(); const { language } = useLanguage();
  const [value,setValue] = useState(profile || { businessName:user?.business || '',sector:'',stage:'starting',size:'micro',location:user?.municipality || '',products:'',goal:'profit',challenges:'',language });
  return <SaveForm label="Save business profile" onSave={async()=>{ await guidance('/profile','PUT',value); await refreshUser(); await reload(); }}><Fields fields={fields} value={value} setValue={setValue} /></SaveForm>;
}
export function ActionCard({ action, reload }: any) {
  const c = useCopy(); const [value,setValue] = useState(action);
  return <Panel><h3 className="font-semibold">{c(action.title)}</h3><p className="text-sm mt-2 text-muted-foreground">{c(action.reason)}</p><p className="text-xs mt-2">{c('Priority')} {action.priority} · {action.effort} · {c('Planning estimate')}</p>
    <div className="my-4 flex flex-wrap gap-2"><Button onClick={()=>navigate(action.tool)}>{c('Open tool')}</Button><Button variant="ghost" onClick={()=>{ sessionStorage.setItem('enterseed-reminder-action',String(action.id)); navigate('calendar'); }}>{c('Add reminder')}</Button></div>
    <SaveForm onSave={async()=>{ await guidance(`/actions/${action.id}`,'PATCH',{ title:value.title,status:value.status,dismissed:value.dismissed }); await reload(); }}>
      <Fields fields={[{key:'title',label:'Action title'},{key:'status',label:'Action status',options:['not_started','in_progress','completed']}]} value={value} setValue={setValue} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.dismissed} onChange={e=>setValue({...value,dismissed:e.target.checked})} />{c('Hide from current plan')}</label>
    </SaveForm></Panel>;
}
export function PlanView() {
  const resource = useResource('/overview'); const c = useCopy();
  if (!resource.data) return <LoadState resource={resource} />;
  const { profile,actions } = resource.data, current = actions.filter((a:any)=>a.active && !a.dismissed), completed = current.filter((a:any)=>a.status==='completed').length;
  return <div className="space-y-6"><PageHeader title={c('My business plan')} lead={c('Your business details turn into three practical next steps.')} /><LoadState resource={resource} />
    <Panel><PanelHeader title={c('Business profile')} description={c('Edit your goals at any time. Completed action history is kept.')} /><ProfileForm profile={profile} reload={resource.reload} /></Panel>
    <section aria-label={c('Business progress')}><h2 className="font-semibold mb-2">{c('Recommended next actions')} · {completed}/{current.length}</h2><progress className="business-progress" max={current.length || 1} value={completed} aria-label={c('Business progress')} /></section>
    {!profile && <p>{c('Save your profile to see your three recommended actions.')}</p>}
    <div className="grid gap-4 xl:grid-cols-3">{current.map((a:any)=><ActionCard key={a.id} action={a} reload={resource.reload} />)}</div>
    <details><summary className="cursor-pointer font-semibold">{c('Action history and hidden actions')}</summary><div className="grid gap-4 mt-4">{actions.filter((a:any)=>!a.active || a.dismissed).map((a:any)=><ActionCard key={a.id} action={a} reload={resource.reload} />)}</div></details>
  </div>;
}
export function GuidanceSummary() {
  const resource = useResource('/overview'); const c = useCopy(); const { isDemo } = useAuth();
  if (isDemo) return null;
  if (!resource.data) return <LoadState resource={resource} />;
  const { profile,actions,reminders,saved,cases } = resource.data;
  const current = actions.filter((a:any)=>a.active && !a.dismissed), done = current.filter((a:any)=>a.status==='completed').length;
  const due = reminders.filter((r:any)=>!r.completed).sort((a:any,b:any)=>a.date.localeCompare(b.date));
  const overdue = due.filter((r:any)=>r.date<=manilaDay()).length;
  const summary = [
    { tool: 'calendar', title: 'Upcoming reminders', count: due.length, icon: Clock3, detail: due[0] ? `${due[0].date} · ${due[0].title}` : c('No pending reminders.') },
    { tool: 'opportunities', title: 'Saved opportunities', count: saved.length, icon: Store },
    { tool: 'support', title: 'Open support requests', count: cases.filter((s:any)=>!['closed','resolved'].includes(s.status)).length, icon: MessageCircle }
  ];
  return <Panel aria-label={c('Business action overview')} className="!bg-brand-soft/40">
    <PanelHeader
      title={profile?.businessName || c('Build your business action plan')}
      description={profile ? `${profile.sector} · ${profile.location}` : c('Tell us your goals and choose your next steps.')}
      action={<Button onClick={()=>navigate('plan')}>{c(profile ? 'Manage my plan' : 'Create business profile')}</Button>}
    />
    <div className="grid items-start gap-6 border-t border-line pt-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">{c('Recommended next actions')}</h3>
          {current.length > 0 && <span className="text-xs text-muted-foreground shrink-0">{done}/{current.length}</span>}
        </div>
        {current.length > 0 ? <>
          <progress className="business-progress mt-3" value={done} max={current.length} aria-label={c('Business progress')} />
          <div className="mt-3 divide-y divide-line">{current.map((a:any)=><button key={a.id} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-brand" onClick={()=>navigate(a.tool)}>
            <span className="min-w-0"><span className="block font-medium">{c(a.title)}</span><span className="block mt-1 text-xs text-muted-foreground">{c(a.status)}</span></span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>)}</div>
        </> : <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{c(profile ? 'Manage my plan' : 'Save your profile to see your three recommended actions.')}</p>}
      </div>
      <div className="min-w-0 divide-y divide-line lg:border-l lg:border-line lg:pl-6">
        {summary.map(({tool,title,count,icon:Icon,detail},index)=><button key={tool} className={`flex w-full items-start gap-3 text-left hover:text-brand ${index === 0 ? 'pb-4' : 'py-4 last:pb-0'}`} onClick={()=>navigate(tool)}>
          <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5">{c(title)}</span>{detail && <span className="block mt-1 text-xs leading-relaxed text-muted-foreground break-words">{detail}</span>}{tool==='calendar' && overdue>0 && <span className="block mt-1 text-xs text-danger">{overdue} {c('due or overdue')}</span>}</span>
          <span className="shrink-0 min-w-6 rounded-md bg-surface px-2 py-0.5 text-center text-xs font-semibold tnum">{count}</span>
        </button>)}
      </div>
    </div>
  </Panel>;
}
