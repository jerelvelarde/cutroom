import React, { useState } from "react";
import { Code2, Film, RefreshCw, Sparkles, ArrowRight } from "lucide-react";
export function DayPlanner({
  plan,
  assets,
  onGenerate,
  onCreateReel,
  busy,
  generating,
}) {
  const [notes, setNotes] = useState(""),
    [view, setView] = useState("sequence"),
    [selected, setSelected] = useState(0);
  const beat = plan?.beats[Math.min(selected, (plan?.beats.length || 1) - 1)];
  return (
    <section className="day-planner">
      <div className="planner-heading">
        <div>
          <h2>Your next story</h2>
          <p>Turn the day’s moments into something worth sharing.</p>
        </div>
        <button
          className="button secondary"
          disabled={generating}
          onClick={() => onGenerate(notes)}
        >
          {generating ? (
            <RefreshCw size={15} className="spin" />
          ) : (
            <Sparkles size={15} />
          )}{" "}
          {generating ? "Planning…" : plan ? "Refine story" : "Find the story"}
        </button>
      </div>
      <textarea
        aria-label="Planning direction"
        placeholder="What happened today? Give Argon a direction…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2500}
        rows={2}
      />
      {!plan ? (
        <div className="planner-empty">
          <h3>Every camera roll has a story.</h3>
          <p>
            Argon finds the strongest angle, arranges your moments, and writes
            an interactive storyboard.
          </p>
        </div>
      ) : (
        <>
          <div className="story-lead">
            <h2>{plan.title}</h2>
            <p>{plan.mainStory}</p>
            <details className="story-evidence">
              <summary>Why this story?</summary>
              <p>{plan.whyToday}</p>
            </details>
          </div>
          <nav className="plan-views" aria-label="Story views">
            {[
              ["sequence", "Shot sequence"],
              ["canvas", "Visual explanation"],
              ["code", "Generated code"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                {id === "code" && <Code2 size={13} />} {label}
              </button>
            ))}
          </nav>
          {view === "code" ? (
            <pre className="storyboard-code">{plan.html}</pre>
          ) : view === "canvas" ? (
            <>
              <iframe
                key={plan.id}
                className="storyboard-frame"
                title="Argon-generated visual story plan"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={plan.document}
              />
              <p className="generated-code-note">
                HTML and CSS written by Argon. Preview runs in an isolated
                sandbox.
              </p>
            </>
          ) : (
            <>
              <div className="sequence-grid">
                {plan.beats.map((b, i) => {
                  const a = assets.find((x) => x.id === b.assetId);
                  return (
                    <button
                      key={b.assetId}
                      aria-label={`Story beat ${i + 1}: ${b.role}`}
                      aria-pressed={selected === i}
                      className={selected === i ? "active" : ""}
                      onClick={() => setSelected(i)}
                    >
                      <div>
                        <img src={a?.thumbnailUrl} alt={a?.name || b.label} />
                        <span>{String(i + 1).padStart(2, "0")}</span>
                      </div>
                      <strong>{b.role}</strong>
                      <small>{a?.name || b.label}</small>
                    </button>
                  );
                })}
              </div>
              {beat && (
                <div className="beat-explanation">
                  <span>
                    {String(selected + 1).padStart(2, "0")} /{" "}
                    {String(plan.beats.length).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{beat.label}</h3>
                    <p>{beat.explanation}</p>
                    {beat.onScreenText && (
                      <small>On screen: “{beat.onScreenText}”</small>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          <div className="story-action">
            <div>
              <strong>Ready to see it in motion?</strong>
              <p>Use this sequence as the direction for your next cut.</p>
            </div>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => onCreateReel(plan)}
            >
              <Film size={15} />
              Make this reel
              <ArrowRight size={14} />
            </button>
          </div>
          <h3 className="planner-subtitle">Other ways to tell it</h3>
          <div className="angle-list">
            {plan.angles.map((angle, i) => (
              <details key={i}>
                <summary>
                  <span>{angle.name}</span>
                  <small className={angle.fit === "strong" ? "strong-fit" : ""}>
                    {angle.fit}
                  </small>
                </summary>
                <p>{angle.premise}</p>
                <p>{angle.reason}</p>
                {angle.missingEvidence && (
                  <small>{angle.missingEvidence}</small>
                )}
              </details>
            ))}
          </div>
          <details className="caption-section">
            <summary>Hook & caption draft</summary>
            <h4>Opening hook</h4>
            <p>{plan.hook}</p>
            <h4>Caption</h4>
            <p>{plan.caption}</p>
          </details>
        </>
      )}
    </section>
  );
}
