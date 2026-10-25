import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  registerRoot,
  useCurrentFrame,
} from "remotion";
const ink = "#18212d",
  muted = "#667182",
  accent = "#245fe8";
const stages = [
  {
    from: 0,
    to: 8,
    title: "Your day has a story.",
    body: "Find it with Cutroom.",
    kind: "intro",
  },
  {
    from: 8,
    to: 18,
    title: "Start with your own footage.",
    body: "Photos and videos from your Mac or SSD. Your originals stay untouched.",
    kind: "capture",
  },
  {
    from: 18,
    to: 25,
    title: "Find the story before the cut.",
    body: "Argon proposes an angle and puts the moments in order.",
    kind: "plan",
  },
  {
    from: 25,
    to: 30,
    title: "A storyboard that explains itself.",
    body: "Argon writes the visual explanation in inspectable HTML and CSS.",
    kind: "code",
  },
  {
    from: 30,
    to: 40,
    title: "Keep the conversation going.",
    body: "Real tools. Reviewed versions. Your feedback, all the way through.",
    kind: "editor",
  },
  {
    from: 40,
    to: 48,
    title: "Make the colors belong together.",
    body: "HDR to Rec.709, then restrained shot-by-shot corrections.",
    kind: "color",
  },
  {
    from: 48,
    to: 55,
    title: "A reel you can keep refining.",
    body: "Inspect the cuts. Adjust the timeline. Export a new version.",
    kind: "reel",
  },
  {
    from: 55,
    to: 60,
    title: "Cutroom.",
    body: "Your footage. Your story.",
    kind: "end",
  },
];
function Scene({ scene, assets }) {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });
  const shift = interpolate(f, [0, 16], [15, 0], { extrapolateRight: "clamp" });
  const picture = {
    plan: assets.plan,
    code: assets.code,
    editor: assets.editor,
    color: assets.color,
  }[scene.kind];
  const video =
    scene.kind === "capture"
      ? assets.capture
      : ["intro", "reel"].includes(scene.kind)
        ? assets.reel
        : null;
  const portrait = ["intro", "reel"].includes(scene.kind);
  if (scene.kind === "end")
    return (
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          background: ink,
          color: "#fff",
          opacity,
        }}
      >
        <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: -4 }}>
          cutroom<span style={{ color: "#7da4ff" }}>.</span>
        </div>
        <div style={{ fontSize: 34, color: "#d3dbea", marginTop: 20 }}>
          Your footage. Your story.
        </div>
        <div style={{ fontSize: 24, color: "#a9b5c6", marginTop: 70 }}>
          Gemini Argon · CopilotKit · Remotion · FFmpeg
        </div>
        <div style={{ fontSize: 22, color: "#c8d3e5", marginTop: 36 }}>
          github.com/jerelvelarde/hackathon-gemini-argon
        </div>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill
      style={{
        opacity,
        display: "flex",
        flexDirection: "row",
        padding: "108px 70px 108px",
        gap: 54,
      }}
    >
      <div
        style={{
          width: 450,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transform: `translateY(${shift}px)`,
        }}
      >
        <h1
          style={{
            fontSize: scene.kind === "intro" ? 76 : 59,
            lineHeight: 1.05,
            letterSpacing: -2,
            fontWeight: 650,
            margin: "0 0 32px",
            color: ink,
          }}
        >
          {scene.title}
        </h1>
        <p style={{ fontSize: 27, lineHeight: 1.5, color: muted, margin: 0 }}>
          {scene.body}
        </p>
        {scene.kind === "intro" && (
          <div style={{ fontSize: 24, color: accent, marginTop: 36 }}>
            Built at the Gemini Argon hackathon
          </div>
        )}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: portrait ? 480 : "100%",
            height: portrait ? 850 : 850,
            borderRadius: 14,
            overflow: "hidden",
            background: portrait ? ink : "#fff",
            border: portrait ? "none" : "1px solid #e0e5ec",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {video ? (
            <OffthreadVideo
              muted
              src={video}
              startFrom={scene.kind === "reel" ? 24 * 17 : 0}
              style={{
                width: "100%",
                height: "100%",
                objectFit: portrait ? "cover" : "contain",
              }}
            />
          ) : (
            <Img
              src={picture}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}
function Demo({ assets, voiceLabel = "ElevenLabs stock synthetic voice" }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{ background: "#f6f8fb", fontFamily: "Arial, sans-serif" }}
    >
      {stages.map((s) => (
        <Sequence
          key={s.from}
          from={s.from * 24}
          durationInFrames={(s.to - s.from) * 24}
        >
          <Scene scene={s} assets={assets} />
        </Sequence>
      ))}
      <Sequence from={12}>
        <Audio src={assets.narration} />
      </Sequence>
      {frame < 55 * 24 && (
        <>
          <div
            style={{
              position: "absolute",
              top: 35,
              left: 70,
              color: ink,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            cutroom<span style={{ color: accent }}>.</span>
          </div>
          <div
            style={{
              position: "absolute",
              top: 42,
              right: 70,
              fontSize: 17,
              color: muted,
            }}
          >
            Product walkthrough · real footage and interface captures
          </div>
        </>
      )}
      <div
        style={{
          position: "absolute",
          left: 70,
          bottom: 30,
          color: frame >= 55 * 24 ? "#a9b5c6" : muted,
          fontSize: 16,
        }}
      >
        Narration: {voiceLabel}
      </div>
      <div
        style={{
          position: "absolute",
          right: 70,
          bottom: 30,
          fontSize: 16,
          color: frame >= 55 * 24 ? "#a9b5c6" : muted,
        }}
      >
        Argon through Google’s API · media processing on your Mac
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          height: 4,
          width: `${((frame + 1) / 1440) * 100}%`,
          background: accent,
        }}
      />
    </AbsoluteFill>
  );
}
registerRoot(() => (
  <Composition
    id="CutroomDemo"
    component={Demo}
    width={1920}
    height={1080}
    fps={24}
    durationInFrames={1440}
    defaultProps={{ assets: {} }}
  />
));
