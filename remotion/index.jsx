import React from 'react';
import { registerRoot, Composition, AbsoluteFill, OffthreadVideo, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

function Opening({ title, subtitle, accent }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 24, stiffness: 90 } });
  const opacity = interpolate(frame, [0, 8, 68, 84], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity, justifyContent: 'flex-end', padding: '0 66px 260px', background: 'linear-gradient(transparent 20%,rgba(10,20,15,.78))' }}>
    <div style={{ width: 44 + enter * 70, height: 5, background: accent, marginBottom: 26 }}/>
    <div style={{ fontFamily: 'Arial, sans-serif', fontWeight: 700, fontSize: title.length > 45 ? 54 : 68, letterSpacing: -2.5, lineHeight: 1.05, color: '#fff9ec', transform: `translateY(${(1 - enter) * 45}px)` }}>{title}</div>
    <div style={{ color: '#fff4d7', fontFamily: 'Arial, sans-serif', fontSize: 18, letterSpacing: 3.5, textTransform: 'uppercase', marginTop: 24 }}>{subtitle}</div>
  </AbsoluteFill>;
}
function Chapter({ text, index, accent, frames }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, Math.max(9, frames - 10), frames], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const x = interpolate(frame, [0, 14], [15, 0], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity, justifyContent: 'flex-end', padding: '0 66px 230px', background: 'linear-gradient(transparent 70%,rgba(10,20,15,.5))' }}><div style={{ display: 'flex', alignItems: 'center', gap: 16, transform: `translateX(${x}px)` }}><span style={{ width: 36, height: 36, borderRadius: '50%', background: accent, color: '#fff8ee', font: 'bold 13px Arial', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{String(index + 1).padStart(2, '0')}</span><span style={{ font: '500 23px Arial', color: '#fffaf0', maxWidth: 470, lineHeight: 1.3 }}>{text}</span></div></AbsoluteFill>;
}
function Reel({ videoSrc, title, subtitle, chapters, accent = '#df7857', style = 'editorial' }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const endFade = interpolate(frame, [durationInFrames - 18, durationInFrames], [1, 0.35], { extrapolateLeft: 'clamp' });
  return <AbsoluteFill style={{ background: '#14251d' }}>
    <AbsoluteFill style={{ opacity: endFade }}><OffthreadVideo src={videoSrc} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></AbsoluteFill>
    <Sequence from={0} durationInFrames={Math.min(86, durationInFrames)}><Opening title={title} subtitle={subtitle} accent={accent}/></Sequence>
    {chapters.map((chapter, index) => {
      const from = Math.max(88, Math.round(chapter.start * fps));
      const frames = Math.min(Math.round(chapter.duration * fps), durationInFrames - from);
      if (frames < 15 || !chapter.text || style === 'minimal') return null;
      return <Sequence key={index} from={from} durationInFrames={frames}><Chapter text={chapter.text} index={index} accent={accent} frames={frames}/></Sequence>;
    })}
    <div style={{ position: 'absolute', top: 140, left: 66, right: 66, height: 2, background: '#ffffff30' }}><div style={{ width: `${(frame + 1) / durationInFrames * 100}%`, height: '100%', background: accent }}/></div>
    <div style={{ position: 'absolute', right: 66, top: 158, color: '#fff9eac9', font: '11px Arial', letterSpacing: 3 }}>A FEW MOMENTS, KEPT.</div>
  </AbsoluteFill>;
}
const Root = () => <Composition id="CutroomReel" component={Reel} width={720} height={1280} fps={24} durationInFrames={720} defaultProps={{ videoSrc: '', title: 'The moments in between', subtitle: 'A little story', chapters: [] }} calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames || 720 })}/>;
registerRoot(Root);
