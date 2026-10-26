import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  FolderOpen,
  LoaderCircle,
  LockKeyhole,
  Play,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Voiceover } from "./Voiceover.jsx";
import { GooglePhotos } from "./GooglePhotos.jsx";
import { DayPlanner } from "./DayPlanner.jsx";
import { StudioCanvas } from "./Studio.jsx";
import { CopilotPanel } from "./CopilotPanel.jsx";
import "./styles.css";
import "./polish.css";

const BUSY = new Set([
  "queued",
  "analyzing",
  "editing",
  "rendering",
  "reviewing",
  "repairing",
  "polishing",
]);
const day = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const duration = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const today = day();

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers:
      options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

function App() {
  const [assets, setAssets] = useState([]),
    [runs, setRuns] = useState([]),
    [source, setSource] = useState(null);
  const [config, setConfig] = useState({
    configured: false,
    verified: false,
    autoEdit: false,
  });
  const [workspace, setWorkspace] = useState("edit"),
    [storyboard, setStoryboard] = useState(null),
    [planning, setPlanning] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [libraryVisible, setLibraryVisible] = useState(
    () => localStorage.getItem("cutroom-library-visible") !== "false",
  );
  const [voiceoverRequest, setVoiceoverRequest] = useState(0);
  const [chatEpoch, setChatEpoch] = useState(0);
  useEffect(() => {
    localStorage.setItem("cutroom-library-visible", String(libraryVisible));
  }, [libraryVisible]);
  const [runId, setRunId] = useState(null),
    [revision, setRevision] = useState(null);
  const storyMode = "discover",
    startDate = today,
    endDate = today;
  const [targetDuration, setTargetDuration] = useState(30);
  const [selected, setSelected] = useState([]),
    [query, setQuery] = useState("");
  const [showConfig, setShowConfig] = useState(false),
    [inspect, setInspect] = useState(null),
    [folderPicker, setFolderPicker] = useState(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState("");
  const refresh = useCallback(async () => {
    const [a, r, c, s] = await Promise.all([
      api("/api/assets"),
      api("/api/runs"),
      api("/api/config"),
      api("/api/source"),
    ]);
    setAssets(a);
    setRuns(r);
    setConfig(c);
    setSource(s);
    const board = await api("/api/storyboard").catch(() => null);
    if (board) setStoryboard(board);
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [refresh]);
  const run =
    runId === "new" ? null : runs.find((r) => r.id === runId) || runs[0];
  const activeRun = runs.find((r) => BUSY.has(r.status));
  const busy = Boolean(activeRun || pending);
  let previewRun = run;
  const visited = new Set();
  while (
    previewRun &&
    !previewRun.versions.length &&
    previewRun.parentRunId &&
    !visited.has(previewRun.id)
  ) {
    visited.add(previewRun.id);
    previewRun = runs.find((r) => r.id === previewRun.parentRunId);
  }
  const current =
    previewRun?.versions.find((v) => v.id === revision) ||
    previewRun?.versions.at(-1);
  useEffect(() => {
    if (runs[0]?.parentRunId === runId) {
      setRunId(runs[0].id);
      setRevision(null);
    }
  }, [runs[0]?.id]);

  const newVideo = useCallback(() => {
    setChatEpoch((n) => n + 1);
    setRunId("new");
    setRevision(null);
    setSelectedClip(null);
    setWorkspace("edit");
  }, []);
  const copilotAction = useCallback(
    async (result) => {
      try {
        if (result.runId && result.command !== "stop_run") {
          setRunId(result.runId);
          setRevision(result.version ?? null);
          setSelectedClip(null);
          setWorkspace("edit");
        }
        switch (result.command) {
          case "hide_library":
            setLibraryVisible(false);
            break;
          case "show_library":
            setLibraryVisible(true);
            break;
          case "show_plan":
            setWorkspace("plan");
            break;
          case "show_editor":
            setWorkspace("edit");
            break;
          case "choose_folder":
            setFolderPicker("source");
            break;
          case "save_reel":
            setFolderPicker("export");
            break;
          case "settings":
            setShowConfig(true);
            break;
          case "voiceover":
            setWorkspace("edit");
            setVoiceoverRequest((n) => n + 1);
            break;
          case "stop_run":
            await api(`/api/runs/${result.runId}/cancel`, {
              method: "POST",
              body: "{}",
            });
            break;
        }
        await refresh();
      } catch (e) {
        setError(e.message);
      }
    },
    [refresh],
  );

  const personal = assets.filter((a) => a.kind !== "fixture");
  const shown = personal.filter((a) =>
    `${a.name} ${a.analysis?.summary || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const action = async (label, fn) => {
    setError("");
    setNotice("");
    setPending(label);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setPending("");
    }
  };
  const connectFolder = (path) =>
    action("Reading your folder…", async () => {
      const result = await api("/api/source", {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      setSelected([]);
      setNotice(
        `${result.folder.count} moments ready. ${result.errors.map((e) => `${e.name}: ${e.error}`).join(" ")}`,
      );
      setFolderPicker(null);
    });
  const exportToFolder = (path) =>
    action("Saving reel…", async () => {
      const result = await api(`/api/runs/${previewRun.id}/export`, {
        method: "POST",
        body: JSON.stringify({ path, version: current.id }),
      });
      setNotice(`Saved to ${result.path}`);
      setFolderPicker(null);
    });
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/">
          cutroom<span>.</span>
        </a>
        <span className="local-label">Your footage. Your story.</span>
        <button
          className="settings-button"
          onClick={() => setShowConfig(true)}
          aria-label="Connection settings"
        >
          <span className={`status-dot ${config.verified ? "verified" : ""}`} />
          {config.verified
            ? "Argon connected"
            : config.configured
              ? "Argon configured"
              : "Connect Argon"}
          <Settings2 size={16} />
        </button>
      </header>
      <main>
        <div className="workspace-heading">
          <div>
            <h1>
              {source?.path.split("/").filter(Boolean).at(-1) ||
                "A story starts here."}
            </h1>
            <p>
              {personal.length
                ? `${personal.length} moments · ${personal.filter((a) => a.analysis).length} understood by Argon`
                : "Connect a folder to find the story in your day."}
            </p>
          </div>
          <div className="source-actions">
            <button
              className="button secondary"
              aria-expanded={libraryVisible}
              aria-controls="media-library"
              onClick={() => setLibraryVisible((v) => !v)}
            >
              {libraryVisible ? (
                <PanelLeftClose size={16} />
              ) : (
                <PanelLeftOpen size={16} />
              )}
              {libraryVisible ? "Hide library" : "Show library"}
            </button>
            <GooglePhotos busy={busy} onImported={refresh} />
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setFolderPicker("source")}
            >
              <FolderOpen size={17} />
              {source ? "Change folder" : "Choose folder"}
            </button>
            {source && (
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => connectFolder(source.path)}
                aria-label="Rescan source folder"
              >
                <RefreshCw size={16} />
              </button>
            )}
          </div>
        </div>
        {(error || notice || pending) && (
          <div
            className={`banner ${error ? "error-banner" : ""}`}
            role={error ? "alert" : "status"}
          >
            {pending ? (
              <LoaderCircle size={17} className="spin" />
            ) : error ? (
              <CircleAlert size={17} />
            ) : (
              <Check size={17} />
            )}
            <span>{error || pending || notice}</span>
            {!pending && (
              <button
                aria-label="Dismiss notification"
                onClick={() => {
                  setError("");
                  setNotice("");
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <div className={`workbench ${libraryVisible ? "" : "library-hidden"}`}>
          <section
            className="library"
            id="media-library"
            hidden={!libraryVisible}
          >
            <div className="section-heading">
              <h2>
                Library <span>{personal.length}</span>
              </h2>
              {personal.length > 0 && (
                <label className="search-input">
                  <Search size={15} />
                  <input
                    aria-label="Search library"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                  />
                </label>
              )}
            </div>
            {personal.length > 0 ? (
              <>
                <div className="library-help">
                  <span>
                    {selected.length
                      ? `${selected.length} selected`
                      : "Choose moments, or let Argon decide."}
                  </span>
                  {selected.length > 0 && (
                    <button onClick={() => setSelected([])}>Clear</button>
                  )}
                </div>
                <div className="asset-grid">
                  {shown.map((asset) => (
                    <article
                      className={`asset-card ${selected.includes(asset.id) ? "selected" : ""}`}
                      key={asset.id}
                    >
                      <button
                        className="asset-image"
                        onClick={() => setInspect(asset)}
                      >
                        <img
                          src={asset.thumbnailUrl}
                          alt={asset.name}
                          loading="lazy"
                        />
                        {asset.mediaType !== "photo" && (
                          <span className="asset-type">
                            <Play size={11} />
                            {duration(asset.duration)}
                          </span>
                        )}
                      </button>
                      <button
                        className="select-asset"
                        disabled={busy}
                        aria-label={`Select ${asset.name}`}
                        aria-pressed={selected.includes(asset.id)}
                        onClick={() =>
                          setSelected((ids) =>
                            ids.includes(asset.id)
                              ? ids.filter((id) => id !== asset.id)
                              : [...ids, asset.id],
                          )
                        }
                      >
                        {selected.includes(asset.id) && <Check size={13} />}
                      </button>
                      <div className="asset-info">
                        <h3 title={asset.relativePath || asset.name}>
                          {asset.name}
                        </h3>
                        <small>
                          {asset.mediaType === "photo"
                            ? "Photo"
                            : duration(asset.duration)}
                          {asset.analysis ? " · Analyzed" : ""}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
                {!shown.length && (
                  <p className="empty-search">No matching moments.</p>
                )}
              </>
            ) : (
              <button
                className="empty-library"
                disabled={busy}
                onClick={() => setFolderPicker("source")}
              >
                <FolderOpen size={36} strokeWidth={1.2} />
                <h3>Start with a folder.</h3>
                <p>
                  Photos and videos from your Mac or SSD.
                  <br />
                  Originals stay where they are.
                </p>
                <span>
                  Choose folder <ArrowRight size={15} />
                </span>
              </button>
            )}
          </section>
          <section className="editor">
            <nav className="workspace-tabs" aria-label="Content workspace">
              <button
                className={workspace === "edit" ? "active" : ""}
                onClick={() => setWorkspace("edit")}
              >
                Edit reel
              </button>
              <button
                className={workspace === "plan" ? "active" : ""}
                onClick={() => setWorkspace("plan")}
              >
                Plan the day
              </button>
              <button className="new-video-button" onClick={newVideo}>
                <Plus size={14} /> New video
              </button>
            </nav>
            {workspace === "plan" ? (
              <DayPlanner
                plan={storyboard}
                assets={assets}
                busy={busy}
                generating={planning}
                onGenerate={async (feedback) => {
                  setPlanning(true);
                  setError("");
                  try {
                    setStoryboard(
                      await api("/api/storyboard", {
                        method: "POST",
                        body: JSON.stringify({ feedback }),
                      }),
                    );
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setPlanning(false);
                  }
                }}
                onCreateReel={(plan) =>
                  action("Making your planned story…", async () => {
                    const result = await api("/api/runs", {
                      method: "POST",
                      body: JSON.stringify({
                        mode: "managed",
                        storyMode: "discover",
                        targetDuration: 30,
                        assetIds: plan.beats.map((b) => b.assetId),
                        brief:
                          `Main story: ${plan.mainStory}. Hook: ${plan.hook}. Follow this source order and story roles: ${plan.beats.map((b) => `${b.assetId}: ${b.role} — ${b.label}`).join("; ")}. Match color naturally, preserve truthful details and use minimal titles.`.slice(
                            0,
                            2000,
                          ),
                      }),
                    });
                    setRunId(result.id);
                    setRevision(null);
                    setWorkspace("edit");
                  })
                }
              />
            ) : (
              <>
                <div className="section-heading">
                  <h2>{current?.plan.title || "Your reel"}</h2>
                  <span>
                    9:16 ·{" "}
                    {current
                      ? `${current.plan.duration.toFixed(0)} sec`
                      : "MP4"}
                  </span>
                </div>
                {current && (
                  <div className="export-row">
                    <Voiceover
                      run={previewRun}
                      current={current}
                      busy={busy}
                      openRequest={voiceoverRequest}
                      showTrigger={false}
                      onRequestHandled={() => setVoiceoverRequest(0)}
                    />
                    <select
                      aria-label="Preview version"
                      value={current.id}
                      onChange={(e) => setRevision(Number(e.target.value))}
                    >
                      {previewRun.versions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.polished ? "Polished" : "Cut"} {v.id}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button primary"
                      disabled={Boolean(pending)}
                      onClick={() => setFolderPicker("export")}
                    >
                      <ArrowDownToLine size={16} />
                      Save reel…
                    </button>
                  </div>
                )}
                {!current && !run && (
                  <div className="new-video-intro">
                    <h3>Make something from your day.</h3>
                    <p>
                      Tell the copilot the story you want to tell. It will
                      choose moments, create a cut, review it, and render your
                      video.
                    </p>
                    <label>
                      Video length{" "}
                      <select
                        aria-label="New video length"
                        value={targetDuration}
                        onChange={(e) =>
                          setTargetDuration(Number(e.target.value))
                        }
                      >
                        {[15, 30, 45, 60].map((n) => (
                          <option key={n} value={n}>
                            {n} seconds
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="new-video-source">
                      {selected.length
                        ? `${selected.length} selected moments`
                        : `${personal.length} moments in your library`}{" "}
                      · {targetDuration} seconds · Vertical MP4
                    </p>
                    <p>
                      Try “Create a video about my hackathon day” in the editing
                      copilot.
                    </p>
                  </div>
                )}
                {(current || run) && (
                  <StudioCanvas
                    current={current}
                    assets={assets}
                    selectedClip={selectedClip}
                    onSelectClip={setSelectedClip}
                    busy={busy}
                    onApply={(plan) =>
                      action("Queuing timeline revision…", async () => {
                        const result = await api(`/api/runs/${run.id}/revise`, {
                          method: "POST",
                          body: JSON.stringify({
                            feedback:
                              "Apply my manual timeline exactly, including trims, order, framing and color values. Preserve these choices unless a technical validity error requires repair. Keep titles minimal.",
                            plan,
                            targetDuration: plan.duration,
                            selectedClip,
                            requestId: crypto.randomUUID(),
                          }),
                        });
                        setRunId(result.id);
                        setRevision(null);
                      })
                    }
                  />
                )}

                {runs.length > 1 && (
                  <label className="history-select">
                    Previous reels
                    <select
                      value={run?.id || ""}
                      onChange={(e) => {
                        setRunId(e.target.value);
                        setRevision(null);
                        setSelectedClip(0);
                      }}
                    >
                      {!run && <option value="">New video</option>}
                      {runs.map((r) => (
                        <option value={r.id} key={r.id}>
                          {r.versions.at(-1)?.plan.title || "Untitled edit"} ·{" "}
                          {new Date(r.createdAt).toLocaleDateString()} ·{" "}
                          {r.status}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}{" "}
          </section>
          <CopilotPanel
            run={run}
            current={current}
            selectedClip={selectedClip}
            runs={runs}
            assetIds={selected}
            assetCount={personal.length}
            targetDuration={targetDuration}
            storyMode={storyMode}
            startDate={startDate}
            endDate={endDate}
            libraryVisible={libraryVisible}
            onAction={copilotAction}
            chatEpoch={chatEpoch}
          />
        </div>
      </main>
      <footer>
        <span>
          Originals stay on your drive. Argon analyzes previews through Google’s
          API.
        </span>
        <details>
          <summary>About</summary>
          <a href="/docs/LOCAL-MAC.md" target="_blank" rel="noreferrer">
            Local workflow
          </a>
        </details>
      </footer>
      {folderPicker && (
        <FolderPicker
          title={
            folderPicker === "source"
              ? "Choose a source folder"
              : "Save reel to a folder"
          }
          initialPath={source?.path}
          busy={Boolean(pending)}
          onClose={() => setFolderPicker(null)}
          onChoose={folderPicker === "source" ? connectFolder : exportToFolder}
          error={error}
        />
      )}
      {showConfig && (
        <Connection
          config={config}
          onClose={() => setShowConfig(false)}
          onChange={refresh}
          busy={Boolean(activeRun)}
        />
      )}
      {inspect && (
        <AssetDetail
          asset={assets.find((a) => a.id === inspect.id) || inspect}
          onClose={() => setInspect(null)}
          onDate={(date) =>
            action("Updating date…", () =>
              api(`/api/assets/${inspect.id}`, {
                method: "PATCH",
                body: JSON.stringify({ captureDate: date || null }),
              }),
            )
          }
          busy={busy}
        />
      )}
    </div>
  );
}

function FolderPicker({ title, initialPath, busy, onClose, onChoose, error }) {
  const [location, setLocation] = useState(initialPath || ""),
    [listing, setListing] = useState(null),
    [loading, setLoading] = useState(false),
    [failure, setFailure] = useState("");
  const browse = async (path) => {
    setLoading(true);
    setFailure("");
    try {
      const next = await api("/api/folders", {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      setListing(next);
      setLocation(next.path);
    } catch (e) {
      setFailure(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    browse(initialPath);
  }, []);
  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <p className="modal-copy">
        Browse your Mac or a mounted drive. You can change folders at any time.
      </p>
      <div className="folder-shortcuts">
        <button
          disabled={busy || loading}
          onClick={() => browse(listing?.home)}
        >
          Home
        </button>
        <button disabled={busy || loading} onClick={() => browse("/Volumes")}>
          External drives
        </button>
        <button
          disabled={busy || loading || !listing}
          onClick={() => browse(listing?.parent)}
        >
          Up a folder
        </button>
      </div>
      <form
        className="folder-path"
        onSubmit={(e) => {
          e.preventDefault();
          browse(location);
        }}
      >
        <input
          aria-label="Folder path"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="/Volumes/Your SSD/Footage"
          disabled={busy || loading}
        />
        <button className="button secondary" disabled={busy || loading}>
          Go
        </button>
      </form>
      <div className="folder-list" aria-busy={loading}>
        {loading ? (
          <p>Opening folder…</p>
        ) : listing?.folders.length ? (
          listing.folders.map((folder) => (
            <button
              key={folder.path}
              disabled={busy}
              onClick={() => browse(folder.path)}
            >
              <FolderOpen size={17} />
              {folder.name}
              <ChevronRight size={15} />
            </button>
          ))
        ) : (
          <p>No subfolders. You can choose the current folder.</p>
        )}
      </div>
      {(failure || error) && (
        <p className="form-error" role="alert">
          {failure || error}
        </p>
      )}
      <p className="field-note">
        {title.startsWith("Choose")
          ? "Includes subfolders, up to 100 photos and clips. Choosing a folder replaces the active library; earlier reels are kept."
          : "Saves a new MP4. Existing files are never overwritten."}
      </p>
      <button
        className="button primary full-width"
        disabled={
          busy ||
          loading ||
          !listing ||
          location !== listing.path ||
          Boolean(failure)
        }
        onClick={() => onChoose(listing.path)}
      >
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <Check size={16} />
        )}{" "}
        {busy ? "Working…" : "Use this folder"}
      </button>
    </Modal>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide-modal" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Connection({ config, onClose, onChange, busy }) {
  const [key, setKey] = useState(""),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false);
  const connect = async (e) => {
    e.preventDefault();
    setWorking(true);
    setError("");
    setSuccess(false);
    try {
      if (key.trim()) {
        await api("/api/config", {
          method: "POST",
          body: JSON.stringify({ apiKey: key }),
        });
        setKey("");
      }
      await api("/api/config/verify", { method: "POST", body: "{}" });
      await onChange();
      setSuccess(true);
    } catch (e) {
      setError(e.message);
      await onChange();
    } finally {
      setWorking(false);
    }
  };
  return (
    <Modal title="Argon connection" onClose={onClose}>
      <div className="connection-art">
        <Sparkles size={29} />
        <span>
          Gemini 4 Argon
          <br />
          <strong>+ Managed Agents</strong>
        </span>
      </div>
      <p className="modal-copy">
        Use your hackathon Gemini API key. Cutroom checks access to both the
        model and the managed editor.
      </p>
      <form onSubmit={connect}>
        <label className="field-label">
          GEMINI API KEY
          <input
            className="key-input"
            type="password"
            placeholder={
              config.configured
                ? "A key is configured. Enter a new one to replace it."
                : "Paste your provisioned key"
            }
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            disabled={working || busy}
          />
        </label>
        <p className="field-note">
          <LockKeyhole size={12} />
          Keys stay on your Mac, in server memory or your ignored .env file.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {(success || config.verified) && (
          <p className="form-success">
            <CheckCheck size={16} />
            Model and managed-agent access verified.
          </p>
        )}
        <button
          type="submit"
          className="button primary full-width"
          disabled={working || busy || (!key.trim() && !config.configured)}
        >
          {working ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <ShieldCheck size={16} />
          )}{" "}
          {working ? "Checking model and agent access…" : "Connect & verify"}
        </button>
      </form>
      <div className="connection-options">
        <p>
          Private analysis sends compact previews and selected metadata to
          Google. Originals, analysis, and exports are excluded from GitHub.
          Nothing is posted to social media.
        </p>
      </div>
    </Modal>
  );
}
function AssetDetail({ asset, onClose, onDate, busy }) {
  const [date, setDate] = useState(asset.captureDate || "");
  return (
    <Modal title={asset.name} onClose={onClose} wide>
      <div className="asset-detail-preview">
        {asset.mediaType === "photo" ? (
          <img src={asset.url} alt={asset.analysis?.summary || asset.name} />
        ) : (
          <video src={asset.proxyUrl} controls playsInline autoPlay={false} />
        )}
      </div>
      <div className="asset-detail-bottom">
        <div>
          <span className="eyebrow">SOURCE NOTES</span>
          <p>
            {asset.analysis?.summary ||
              "The editor has not watched this source yet."}
          </p>
          <small>
            {asset.width} × {asset.height} ·{" "}
            {asset.mediaType === "photo"
              ? "Photo"
              : `${asset.duration.toFixed(1)} seconds`}{" "}
            · {(asset.bytes / 1024 / 1024).toFixed(1)} MB
          </small>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onDate(date);
          }}
        >
          <label className="field-label">
            Capture date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
            />
          </label>
          <small>{asset.dateSource || "unknown"} · Pacific time</small>
          <button className="button secondary" disabled={busy} type="submit">
            Save date
          </button>
        </form>
      </div>
      {asset.analysis?.shots && (
        <div className="source-shots">
          {asset.analysis.shots.map((s, i) => (
            <p key={i}>
              <span>
                {asset.mediaType === "photo"
                  ? s.role
                  : `${duration(s.start)}–${duration(s.end)}`}
              </span>
              {s.description}
            </p>
          ))}
        </div>
      )}
      {asset.attribution && (
        <p className="field-note">{asset.attribution.note}</p>
      )}
    </Modal>
  );
}

createRoot(document.getElementById("root")).render(<App />);
