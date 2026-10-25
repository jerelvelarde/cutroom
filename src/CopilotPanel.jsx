import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CopilotKitProvider, CopilotChat, useRenderTool } from '@copilotkit/react-core/v2';
import { HttpAgent } from '@ag-ui/client';
import { z } from 'zod';
import { Check, CircleAlert, LoaderCircle, Wrench } from 'lucide-react';
import '@copilotkit/react-core/v2/styles.css';

const RunsContext = createContext([]);
const busyStates = new Set(['queued','analyzing','editing','rendering','repairing','reviewing','polishing']);
function ToolReceipt({ result, status, parameters }) {
  const runs = useContext(RunsContext);
  let data; try { data = JSON.parse(result || '{}'); } catch { data = {}; }
  const run = runs.find(r => r.id === data.runId);
  const busy = run && busyStates.has(run.status);
  return <div className="copilot-tool-receipt"><div>{busy || !result ? <LoaderCircle size={15} className="spin"/> : run?.status === 'failed' ? <CircleAlert size={15}/> : <Check size={15}/>}<strong>{run ? (busy ? run.events.at(-1)?.title || 'Revision queued' : run.status === 'ready' ? 'Revision ready' : run.status) : 'Start revision'}</strong></div><p>{parameters?.feedback}</p>{run && <><small>{run.versions.length} rendered version{run.versions.length === 1 ? '' : 's'}</small><ToolActivity run={run}/></>}</div>;
}
function RegisteredChat() {
  useRenderTool({ name:'edit_reel', parameters:z.object({feedback:z.string(),parentRunId:z.string()}), render: props => <ToolReceipt {...props}/> }, []);
  useRenderTool({ name:'plan_day',parameters:z.object({feedback:z.string()}),render:({status,result})=><div className="copilot-tool-receipt"><strong>{status==='complete'?'Day plan saved':'Planning the story and writing visualization code…'}</strong><p>{result?'Open Plan the day to review the visual storyboard and content angles.':'Comparing the available moments and building an evidence-based plan.'}</p></div> },[]);
  return <CopilotChat agentId="editor" threadId="cutroom-local-editor" inspectorTools={false} labels={{welcomeMessageText:'What would you like to change?',chatInputPlaceholder:'Give feedback on the reel or selected shot…',chatDisclaimerText:'Argon edits locally through constrained media tools.'}}/>
}
export function ToolActivity({ run }) {
  return <details className="tool-activity"><summary><Wrench size={12}/>Tool calls & decisions <span>{run.toolCalls?.length || 0}</span></summary>{(run.toolCalls || []).map(call=><div className="tool-call" key={call.id}><strong>{call.name.replaceAll('_',' ')}</strong><span>{call.status}</span><p>{call.arguments?.rationale || (call.name === 'review_edit' ? call.result?.visual?.summary : call.arguments?.title)}</p>{call.result?.error && <p className="tool-error">{call.result.error}</p>}<details><summary>Parameters and result</summary><pre>{JSON.stringify({parameters:call.arguments,result:call.result},null,2)}</pre></details></div>)}{run.events.filter(e=>['discovery','color','issue','error'].includes(e.type)).slice(-8).map(e=><div key={e.id} className="decision-note"><strong>{e.title}</strong><p>{e.detail}</p></div>)}</details>;
}
export function CopilotPanel({ run, current, selectedClip, runs }) {
  const [error,setError]=useState('');
  const agents=useMemo(()=>{
    let history=[];try{history=JSON.parse(localStorage.getItem('cutroom-chat-v1')||'[]');}catch{}
    const editor=new HttpAgent({url:'/api/copilot',agentId:'editor',initialMessages:history});
    editor.subscribe({onMessagesChanged:({messages})=>{try{localStorage.setItem('cutroom-chat-v1',JSON.stringify(messages.slice(-150)));}catch{}}});
    return {editor};
  },[]);
  useEffect(()=>{agents.editor.setState({runId:run?.id,version:run?.versions.some(v=>v.id===current?.id)?current?.id:undefined,selectedClip});},[agents,run?.id,current?.id,selectedClip]);
  return <aside className="copilot-panel"><div className="copilot-title"><span className="status-dot verified"/><h2>Editing copilot</h2><span>Argon 4</span></div><p className="copilot-context">{selectedClip !== null && current ? `Discussing shot ${selectedClip+1} · ` : ''}Editing decisions, tool activity, and your feedback.</p><RunsContext.Provider value={runs}><CopilotKitProvider selfManagedAgents={agents} agentId="editor" showDevConsole={false} enableInspector={false} onError={event=>setError(event.error.message)}><RegisteredChat/></CopilotKitProvider></RunsContext.Provider>{error && <p className="form-error" role="alert">{error}</p>}{run && <div className="current-activity"><ToolActivity run={run}/></div>}</aside>;
}
