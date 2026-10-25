import React, { useEffect, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { AbsoluteFill, Video } from 'remotion';
import { ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';

const neutral = { brightness: 0, contrast: 1, saturation: 1, warmth: 0 };
function RenderedReel({ src }) { return <AbsoluteFill style={{ background: '#15171b' }}><Video src={src} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></AbsoluteFill>; }
export function StudioCanvas({ current, assets, selectedClip, onSelectClip, onApply, busy }) {
  const player = useRef(null);
  const [draft, setDraft] = useState(null), [dirty, setDirty] = useState(false), [frame, setFrame] = useState(0);
  useEffect(() => { setDraft(current ? structuredClone(current.plan) : null); setDirty(false); setFrame(0); }, [current?.url]);
  useEffect(() => {
    const p = player.current; if (!p) return;
    const update = e => setFrame(e.detail.frame); p.addEventListener('frameupdate', update);
    return () => p.removeEventListener('frameupdate', update);
  }, [current?.url]);
  const clips = draft?.clips || [], index = Math.min(selectedClip || 0, Math.max(0, clips.length - 1)), clip = clips[index];
  const source = assets.find(a => a.id === clip?.assetId);
  const patch = changes => { setDraft(p => ({ ...p, clips: p.clips.map((c, i) => i === index ? { ...c, ...changes } : c) })); setDirty(true); };
  const grade = { ...neutral, ...clip?.grade };
  const seekShot = i => { onSelectClip(i); player.current?.seekTo(Math.round(clips.slice(0, i).reduce((n,c) => n + c.end - c.start, 0) * 24)); };
  const reorder = offset => { const target = index + offset; if (target < 0 || target >= clips.length) return; setDraft(p => { const next = [...p.clips]; [next[index], next[target]] = [next[target], next[index]]; return { ...p, clips: next }; }); onSelectClip(target); setDirty(true); };
  const total = clips.reduce((n,c) => n + c.end - c.start, 0);
  return <div className="studio-canvas">
    <div className="composition-bar"><span>Composition</span><span>720 × 1280 · 24 fps · {current?.colorManaged ? 'Rec.709' : 'Original render'}</span></div>
    <div className="composition-stage">{current ? <Player ref={player} key={current.url} component={RenderedReel} inputProps={{ src: current.url }} durationInFrames={Math.ceil((current.review?.technical?.info?.duration || current.plan.duration) * 24)} compositionWidth={720} compositionHeight={1280} fps={24} controls style={{ height: '100%', maxWidth: '100%', aspectRatio: '9 / 16' }}/> : <div className="viewer-empty">Choose footage and make your first reel.</div>}</div>
    {current && <><div className="timeline-heading"><strong>Timeline</strong><span>{(frame / 24).toFixed(2)}s / {total.toFixed(2)}s</span></div><div className="shot-timeline">{clips.map((c,i) => { const a = assets.find(x => x.id === c.assetId); return <button key={`${i}-${c.assetId}`} className={index === i ? 'selected-shot' : ''} aria-label={`Shot ${i + 1}: ${a?.name || c.role}`} aria-pressed={index === i} onClick={() => seekShot(i)} style={{ flexGrow: c.end - c.start }}><img src={a?.thumbnailUrl} alt=""/><span>{i + 1}</span><small>{(c.end-c.start).toFixed(1)}s</small></button>; })}</div>
    {clip && <div className="shot-inspector"><div className="inspector-title"><SlidersHorizontal size={15}/><strong>Shot {index + 1}</strong><span title={source?.name}>{source?.name}</span><button disabled={busy || index === 0} onClick={() => reorder(-1)} aria-label="Move shot earlier"><ChevronLeft size={15}/></button><button disabled={busy || index === clips.length-1} onClick={() => reorder(1)} aria-label="Move shot later"><ChevronRight size={15}/></button><button disabled={busy || clips.length <= 1} aria-label="Remove selected shot" onClick={() => { setDraft(p => ({...p, clips:p.clips.filter((_,i)=>i!==index)})); onSelectClip(Math.max(0,index-1)); setDirty(true); }}><Trash2 size={14}/></button></div>
      <p className="source-color">{source?.colorTreatment || (source?.mediaType === 'photo' ? 'sRGB photo' : 'Color profile not checked yet')}{source?.color?.dolbyVision ? ' · Dolby Vision source' : ''}</p>
      <div className="trim-controls"><label>In<input aria-label="Source in point" disabled={busy} type="number" step="0.1" min="0" max={Math.max(0,clip.end-.5)} value={clip.start} onChange={e=>patch({start:Number(e.target.value)})}/></label><label>Out<input aria-label="Source out point" disabled={busy} type="number" step="0.1" min={clip.start+.5} max={source?.duration} value={clip.end} onChange={e=>patch({end:Number(e.target.value)})}/></label><label>Framing<select disabled={busy} value={clip.framing} onChange={e=>patch({framing:e.target.value})}><option value="crop">Fill frame</option><option value="fit">Fit full shot</option></select></label></div>
      <details className="color-controls" open><summary>Color <span>After HDR normalization</span></summary><div className="grade-sliders">{[['brightness','Brightness',-.08,.08,.005],['contrast','Contrast',.85,1.2,.01],['saturation','Saturation',.65,1.25,.01],['warmth','Warmth',-.15,.15,.01]].map(([key,label,min,max,step])=><label key={key}>{label}<input aria-label={label} disabled={busy} type="range" min={min} max={max} step={step} value={grade[key]} onChange={e=>patch({grade:{...grade,[key]:Number(e.target.value)}})}/><output>{grade[key].toFixed(2)}</output></label>)}</div></details>
      <div className="draft-actions"><button disabled={!dirty || busy} onClick={()=>{setDraft(structuredClone(current.plan));setDirty(false);}}><RotateCcw size={13}/>Discard changes</button><button className="button secondary" disabled={!dirty || busy || total < 6 || total > 60} onClick={()=>onApply({...draft, duration:total})}>Render changes</button></div><p className="draft-note">{dirty ? 'Draft changes are not in the preview yet. Render changes to create a reviewed version.' : 'Select a shot to discuss it with Argon or adjust its trim and color.'}</p>
    </div>}</>}
  </div>;
}
