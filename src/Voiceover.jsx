import React, { useEffect, useRef, useState } from "react";
import { Mic, LoaderCircle, X, Check, Download } from "lucide-react";
import "./voiceover.css";
async function request(url, body) {
  const res = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Voiceover request failed.");
  return data;
}
export function Voiceover({
  run,
  current,
  busy,
  openRequest = 0,
  showTrigger = true,
  onRequestHandled,
}) {
  const [open, setOpen] = useState(false),
    [config, setConfig] = useState(null),
    [key, setKey] = useState(""),
    [text, setText] = useState(""),
    [speed, setSpeed] = useState(1),
    [pending, setPending] = useState(""),
    [error, setError] = useState(""),
    [audio, setAudio] = useState(null),
    [result, setResult] = useState(null);
  const dialog = useRef(null);
  useEffect(() => {
    if (openRequest) {
      setOpen(true);
      onRequestHandled?.();
    }
  }, [openRequest]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    request("/api/voiceover")
      .then((c) => {
        setConfig(c);
        setText((t) => t || c.defaultScript);
        setAudio(c.latest);
      })
      .catch((e) => setError(e.message));
  }, [open]);
  const act = async (label, fn) => {
    setPending(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending("");
    }
  };
  return (
    <>
      {showTrigger && (
        <button className="button secondary" onClick={() => setOpen(true)}>
          <Mic size={15} />
          Voiceover
        </button>
      )}
      {open && (
        <dialog
          ref={dialog}
          className="voiceover-dialog"
          onCancel={(e) => {
            if (pending) e.preventDefault();
            else setOpen(false);
          }}
        >
          <div className="voiceover-heading">
            <div>
              <h2>Add a voiceover</h2>
              <p>ElevenLabs · George, a stock synthetic voice</p>
            </div>
            <button
              aria-label="Close voiceover"
              disabled={Boolean(pending)}
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          {config && !config.configured && (
            <form
              className="voiceover-connect"
              onSubmit={(e) => {
                e.preventDefault();
                act("Connecting…", async () => {
                  setConfig(
                    await request("/api/voiceover/config", { apiKey: key }),
                  );
                  setKey("");
                });
              }}
            >
              <label>
                ElevenLabs API key
                <input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Paste your API key"
                  required
                  minLength={10}
                />
              </label>
              <p>
                Stored on this Mac. Only your script is sent to ElevenLabs.
                Generation uses your account’s credits.
              </p>
              <button
                className="button secondary"
                disabled={Boolean(pending) || !key}
              >
                Save connection
              </button>
            </form>
          )}
          <label className="voiceover-script">
            Narration
            <textarea
              rows={8}
              maxLength={3000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tell the story in your own words…"
            />
          </label>
          <div className="voiceover-options">
            <span>
              {text.trim().split(/\s+/).filter(Boolean).length} words ·
              approximately{" "}
              {Math.round(
                text.trim().split(/\s+/).filter(Boolean).length / 2.4 / speed,
              )}{" "}
              seconds
            </span>
            <label>
              Speed
              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                {[0.85, 1, 1.1, 1.2].map((v) => (
                  <option key={v} value={v}>
                    {v}×
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <p className="voiceover-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="button primary"
            disabled={!config?.configured || Boolean(pending) || !text.trim()}
            onClick={() =>
              act("Generating narration…", async () => {
                setResult(null);
                setAudio(
                  await request("/api/voiceover/generate", { text, speed }),
                );
              })
            }
          >
            {pending ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Mic size={15} />
            )}{" "}
            {pending || "Generate voiceover"}
          </button>
          {audio && (
            <div className="voiceover-preview">
              <strong>
                {audio.provider} narration · {audio.duration.toFixed(1)}s
              </strong>
              <audio controls src={audio.url} />
              <a href={audio.url} download className="button secondary">
                <Download size={14} />
                Save audio
              </a>
              {current && (
                <button
                  className="button secondary"
                  disabled={
                    Boolean(pending) ||
                    busy ||
                    audio.duration >
                      (current.review?.technical?.info?.duration ||
                        current.plan.duration) +
                        0.2
                  }
                  onClick={() =>
                    act("Adding voiceover…", async () =>
                      setResult(
                        await request(`/api/voiceover/${audio.id}/apply`, {
                          runId: run.id,
                          version: current.id,
                        }),
                      ),
                    )
                  }
                >
                  Add to current reel
                </button>
              )}
              {current &&
                audio.duration >
                  (current.review?.technical?.info?.duration ||
                    current.plan.duration) +
                    0.2 && (
                  <p>
                    Shorten the narration or create a longer reel to use this
                    audio without cutting it off.
                  </p>
                )}
            </div>
          )}
          {result && (
            <div className="voiceover-result">
              <p>
                <Check size={14} /> New narrated copy ready.
              </p>
              <video controls src={result.url} />
              <a href={result.url} download className="button primary">
                Save narrated reel
              </a>
            </div>
          )}
        </dialog>
      )}
    </>
  );
}
