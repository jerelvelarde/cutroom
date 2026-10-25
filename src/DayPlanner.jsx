import React, { useState } from 'react';
import { Code2, Film, RefreshCw, Sparkles } from 'lucide-react';
export function DayPlanner({ plan, assets, onGenerate, onCreateReel, busy, generating }) {
  const [notes,setNotes]=useState(''),[showCode,setShowCode]=useState(false);
  return <section className="day-planner"><div className="planner-heading"><div><h2>Plan the day</h2><p>Find the story before making the cut.</p></div><button className="button secondary" disabled={generating} onClick={()=>onGenerate(notes)}>{plan?<RefreshCw size={15}/>:<Sparkles size={15}/>} {generating?'Argon is planning…':plan?'Refine plan':'Plan my content'}</button></div>
    <textarea aria-label="Planning direction" placeholder="What should today's content say? Any audience, theme, or moment to emphasize?" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2500} rows={2}/>
    {!plan ? <div className="planner-empty"><Sparkles size={28}/><h3>A story, not just a camera roll.</h3><p>Argon will compare content angles, choose a main story, arrange the actual moments, and write an interactive visual storyboard.</p></div> : <>
      <div className="main-story"><span className="eyebrow">MAIN STORY · {plan.recommendedFormat.toUpperCase()}</span><h2>{plan.title}</h2><p>{plan.mainStory}</p><small>{plan.whyToday}</small></div>
      <div className="storyboard-toolbar"><strong>Visual explanation</strong><button onClick={()=>setShowCode(!showCode)}><Code2 size={14}/>{showCode?'View storyboard':'View Argon’s code'}</button></div>
      {showCode ? <pre className="storyboard-code">{plan.html}</pre> : <iframe key={plan.id} className="storyboard-frame" title="Argon-generated visual story plan" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={plan.document}/>}
      <p className="generated-code-note">Code authored by Argon · Runs in an isolated preview with network access blocked.</p>
      <h3 className="planner-subtitle">Content angles</h3><div className="content-angles">{plan.angles.map((angle,i)=><article key={i}><div><span>{String(i+1).padStart(2,'0')}</span><h3>{angle.name}</h3><small>{angle.fit}</small></div><p>{angle.premise}</p><p className="angle-reason">{angle.reason}</p>{angle.missingEvidence && <small>Needs: {angle.missingEvidence}</small>}</article>)}</div>
      <h3 className="planner-subtitle">Arrange the moments</h3><div className="story-beats">{plan.beats.map((beat,i)=>{const a=assets.find(x=>x.id===beat.assetId);return <article key={beat.assetId}><img src={a?.thumbnailUrl} alt={a?.name||beat.label}/><div><span>{String(i+1).padStart(2,'0')} · {beat.role}</span><h3>{beat.label}</h3><p>{beat.explanation}</p>{beat.onScreenText && <small>On screen: “{beat.onScreenText}”</small>}</div></article>;})}</div>
      <div className="caption-draft"><span className="eyebrow">HOOK</span><p>{plan.hook}</p><span className="eyebrow">CAPTION DRAFT</span><p>{plan.caption}</p></div>
      <button className="button primary full-width" disabled={busy} onClick={()=>onCreateReel(plan)}><Film size={16}/>Make a reel from this plan</button><p className="generated-code-note">Editorial suggestions based on available footage. No predicted engagement or invented outcomes.</p>
    </>}
  </section>;
}
