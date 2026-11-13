import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button, Panel, PanelHeader, PageHeader, Notice } from '../../components/ui';
import { PlanView } from './PlanView';
import { CalendarView } from './CalendarView';
import { SupportView } from './SupportView';
import { OpportunitiesView } from './OpportunitiesView';
import { WorksheetsView } from './WorksheetsView';
import { LoadState, useResource, useCopy, navigate } from './shared';

const guides = [
  ['Starting a business','Write down what you sell, who needs it and how you will deliver it. Test your idea with potential customers before making large purchases. Confirm registration requirements directly with DTI, your LGU and the relevant agencies.','plan'],
  ['Business budgeting','Record cash received and cash paid separately. Review upcoming payments before spending available cash. Keep personal and business transactions separate. Update your finance records each week.','finance'],
  ['Pricing products','Include materials, labor, packaging and delivery. Divide batch costs by usable units. Account for selling fees before setting a target margin. Check whether customers will pay the resulting price.','costing'],
  ['Managing suppliers','Compare the same product specifications and units. Ask about minimum orders, delivery, lead times and payment terms. A cheaper quote may require more stock or earlier payment.','quotations'],
  ['Marketing','Choose one customer group and one clear offer. Explain the benefit and how to contact your business. Review generated drafts before publishing and track which messages lead to inquiries.','marketing'],
  ['Finding government programs','Check the provider’s official page, location coverage and requirements. A potential match does not guarantee eligibility or approval. Save an opportunity and add a reminder only when you have a confirmed date.','opportunities'],
  ['Understanding your action plan','Choose your current business goal. Your plan suggests three practical steps using clear rules. Open a tool, do the work, and then update the action status. You can hide suggestions and revisit completed history.','plan']
];
function GuidesView(){const c=useCopy();return <div className="space-y-6"><PageHeader title={c('Learning guides')} lead={c('Small lessons you can put into practice today.')} /><div className="grid gap-4 lg:grid-cols-2">{guides.map(([title,body,tool])=><Panel key={title}><PanelHeader title={c(title)}/><p className="leading-relaxed text-sm mb-5">{c(body)}</p><Button variant="secondary" onClick={()=>navigate(tool)}>{c('Put this into practice')}</Button></Panel>)}</div><Button variant="ghost" onClick={()=>navigate('support')}>{c('Share pilot feedback')}</Button></div>;}
function MetricsView(){const c=useCopy(),r=useResource('/staff/metrics');if(!r.data)return <LoadState resource={r}/>;const d=r.data;return <div className="space-y-6"><PageHeader title={c('Business impact')} lead={c('Counts reflect recorded actions, not page views. Staff accounts are excluded from business activity metrics.')} /><LoadState resource={r}/><div className="grid gap-4 md:grid-cols-3">{[['MSMEs completing useful actions',d.usefulAccounts],['Weekly active MSMEs',d.activeAccounts],['Repeat users this week',d.repeatAccounts]].map(([title,n])=><Panel key={title}><PanelHeader title={c(String(title))}/><p className="text-3xl font-semibold">{n}</p></Panel>)}</div><Panel><p>{c('Window: rolling seven days. Useful actions: completing a recommendation or first saving a costing or comparison. Active: at least one recorded event. Repeat: events on two or more Manila dates.')}</p><p className="mt-4">{c('Current recommendation completion')}: {d.actions.completed||0}/{d.actions.total} ({d.actions.total?((d.actions.completed||0)/d.actions.total*100).toFixed(1):0}%)</p><p className="mt-4">{c('Average first public staff response')}: {d.response.hours===null?'—':d.response.hours.toFixed(1)} {c('hours')} ({d.response.responded} {c('responded requests')})</p><p className="text-sm mt-2">{c('Response time uses elapsed hours across all responded requests, including weekends. Unanswered requests are excluded.')}</p></Panel><Panel><PanelHeader title={c('Recorded events this week')}/>{d.counts.map((v:any)=><p key={v.name} className="py-2 border-b border-line">{v.name}: {v.accounts} {c('accounts')} / {v.events} {c('events')}</p>)}</Panel></div>;}
export function GuidanceView({page}:{page:string}) {
  const {user,isDemo}=useAuth(),c=useCopy();
  if(isDemo)return <Notice>{c('These features save to a real account. Sign out of demo mode and sign in to use them.')}</Notice>;
  if(page.startsWith('staff-')&&!['admin','staff'].includes(user?.role||''))return <Notice tone="error">{c('Staff access required.')}</Notice>;
  switch(page){
    case 'plan':return <PlanView/>;
    case 'calendar':return <CalendarView/>;
    case 'support':return <SupportView/>;
    case 'staff-support':return <SupportView staffMode/>;
    case 'opportunities':return <OpportunitiesView/>;
    case 'staff-opportunities':return <OpportunitiesView staffMode/>;
    case 'costing':case 'quotations':return <WorksheetsView key={page} kind={page}/>;
    case 'guides':return <GuidesView/>;
    case 'staff-metrics':return <MetricsView/>;
    default:return null;
  }
}
