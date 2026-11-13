import React, { useState } from 'react';
import { Button, Panel, PanelHeader, PageHeader, inputClass } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { supportStatuses } from '../../domain/guidance';
import { Fields, SaveForm, LoadState, useResource, useCopy, guidance } from './shared';

function Conversation({ id, staff, members, reload }: any) {
  const r = useResource(`/support/${id}`), c=useCopy();
  const [reply,setReply] = useState({message:'',internal:false});
  if(!r.data) return <LoadState resource={r} />;
  return <Panel><PanelHeader title={r.data.item.title} description={c(r.data.item.status)} /><LoadState resource={r} />
    {staff&&<Assignment key={id} item={r.data.item} members={members} reload={async()=>{await r.reload();await reload();}} />}
    <div className="space-y-3 my-5">{r.data.replies.map((m:any)=><article key={m.id} className={`rounded-lg p-3 border ${m.internal?'border-highlight bg-highlight-soft':'border-line bg-sunken'}`}><p className="text-xs mb-2">{c(m.internal?'Internal staff note':'Conversation message')} · {m.created_at} UTC</p><p className="whitespace-pre-wrap break-words">{m.message}</p></article>)}</div>
    <SaveForm label="Send response" onSave={async()=>{await guidance(`/support/${id}/replies`,'POST',reply);setReply({message:'',internal:false});await r.reload();await reload();}}>
      <Fields fields={[{key:'message',label:'Your response',type:'textarea'}]} value={reply} setValue={setReply} />
      {staff&&<label className="flex gap-2"><input type="checkbox" checked={reply.internal} onChange={e=>setReply({...reply,internal:e.target.checked})}/>{c('Internal note — visible only to staff')}</label>}
    </SaveForm></Panel>;
}
function Assignment({item,members,reload}:any) {
  const c=useCopy(),[value,setValue]=useState({status:item.status,assignee:item.assignee,followUp:item.follow_up});
  return <SaveForm label="Update request" onSave={async()=>{await guidance(`/staff/support/${item.id}`,'PATCH',value);await reload();}}><Fields fields={[{key:'status',label:'Request status',options:[...supportStatuses]},{key:'followUp',label:'Follow-up date',type:'date',optional:true}]} value={value} setValue={setValue}/><label className="block">{c('Assigned staff')}<select className={inputClass} value={value.assignee||''} onChange={e=>setValue({...value,assignee:Number(e.target.value)||null})}><option value="">{c('Unassigned')}</option>{members.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label></SaveForm>;
}
export function SupportView({ staffMode=false }: { staffMode?: boolean }) {
  const {user}=useAuth(),c=useCopy(),r=useResource(staffMode?'/staff/support':'/support');
  const [selected,setSelected]=useState<number|null>(null),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[form,setForm]=useState({title:'',category:'other',message:''});
  const staff=staffMode&&['staff','admin'].includes(user?.role||'');
  return <div className="space-y-6"><PageHeader title={c(staffMode?'Staff follow-up desk':'Support requests')} lead={c('Keep your questions, responses and next steps together.')} /><LoadState resource={r}/>
    {!staffMode&&<Panel><PanelHeader title={c('Request assistance')} /><SaveForm label="Submit request" onSave={async()=>{const d=await guidance('/support','POST',form);setForm({title:'',category:'other',message:''});setSelected(d.id);await r.reload();}}><Fields fields={[{key:'title',label:'Request title'},{key:'category',label:'Category',options:['finance','registration','suppliers','marketing','technical','pilot_feedback','other']},{key:'message',label:'Describe your concern',type:'textarea'}]} value={form} setValue={setForm}/></SaveForm></Panel>}
    {r.data&&<Panel><PanelHeader title={c('Request history')} /><div className="grid gap-3 sm:grid-cols-2"><label>{c('Search requests')}<input className={inputClass} value={search} onChange={e=>setSearch(e.target.value)}/></label><label>{c('Request status')}<select className={inputClass} value={filter} onChange={e=>setFilter(e.target.value)}>{['all',...supportStatuses].map(s=><option key={s} value={s}>{c(s)}</option>)}</select></label></div>
      {!r.data.cases.length&&<p className="py-4">{c('No requests yet.')}</p>}{r.data.cases.filter((s:any)=>(filter==='all'||s.status===filter)&&`${s.title} ${s.category} ${s.id}`.toLowerCase().includes(search.toLowerCase())).map((s:any)=><button key={s.id} className="block w-full text-left border-t border-line mt-3 py-3" onClick={()=>setSelected(s.id)}><strong>#{s.id} {s.title}</strong><span className="block text-sm">{c(s.status)} · {c(s.category)}{s.follow_up&&` · ${c('Follow-up date')}: ${s.follow_up}`}</span></button>)}</Panel>}
    {selected&&<Conversation key={selected} id={selected} staff={staff} members={r.data?.staff||[]} reload={r.reload}/>}
  </div>;
}
