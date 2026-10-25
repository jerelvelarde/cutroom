import React, { useCallback, useEffect, useRef, useState } from "react";
import { CloudDownload, ExternalLink, LoaderCircle, X } from "lucide-react";
import "./google-photos.css";
const request = async (route, body) => {
  const r = await fetch(
    `/api/google-photos/${route}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Google Photos is unavailable.");
  return data;
};

export function GooglePhotos({ busy = false, onImported }) {
  const [open, setOpen] = useState(false),
    [state, setState] = useState(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [authUrl, setAuthUrl] = useState(""),
    [setup, setSetup] = useState(false);
  const [clientId, setClientId] = useState(""),
    [clientSecret, setClientSecret] = useState("");
  const dialog = useRef(null),
    notified = useRef(null),
    importedCallback = useRef(onImported);
  importedCallback.current = onImported;
  const update = useCallback((next) => {
    setState((previous) => ({ ...previous, ...next }));
    if (
      next.job &&
      next.job.status !== "importing" &&
      next.job.id !== notified.current
    ) {
      notified.current = next.job.id;
      importedCallback.current?.();
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    dialog.current.showModal();
    let stopped = false,
      timer;
    const refresh = async () => {
      try {
        let next = await request("status");
        if (
          next.session &&
          !next.session.ready &&
          Date.now() >= next.session.nextPollAt &&
          Date.now() < next.session.stopPollingAt
        )
          next = { ...next, ...(await request("session")) };
        if (!stopped) update(next);
      } catch (e) {
        if (!stopped) setError(e.message);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 2000);
      }
    };
    refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [open, update]);
  const act = async (fn) => {
    setWorking(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  };
  const importing = state?.job?.status === "importing",
    session = state?.session;
  const expired =
    session && !session.ready && Date.now() >= session.stopPollingAt;
  return (
    <>
      <button
        className="button secondary google-photos-trigger"
        onClick={() => setOpen(true)}
      >
        <CloudDownload size={16} />
        Google Photos
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="modal google-photos-modal"
          onCancel={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="modal-heading">
            <h2>Google Photos</h2>
            <button
              aria-label="Close Google Photos"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <p className="modal-copy">
            Choose moments from your Google Photos account. Selected photos and
            clips download to this Mac and join your current library.
          </p>
          {!state ? (
            <p className="field-note">Checking connection…</p>
          ) : (
            <>
              <div className="google-photos-status">
                <span
                  className={`status-dot ${state.connected ? "verified" : ""}`}
                />
                {state.connected
                  ? "Connected to Google Photos"
                  : state.configured
                    ? "Ready to connect"
                    : "One-time Google setup needed"}
              </div>
              {(!state.configured || setup) && (
                <section className="google-photos-setup">
                  <h3>Connect your Google Cloud app</h3>
                  <ol>
                    <li>
                      Enable{" "}
                      <a
                        href="https://console.cloud.google.com/apis/library/photospicker.googleapis.com"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Google Photos Picker API <ExternalLink size={11} />
                      </a>
                      .
                    </li>
                    <li>
                      Configure Google Auth Platform consent and add your photo
                      account as a test user.
                    </li>
                    <li>
                      Create an OAuth client of type{" "}
                      <strong>Web application</strong>. Add this authorized
                      redirect URI:<code>{state.redirectUri}</code>
                    </li>
                  </ol>
                  <p className="field-note">
                    The Gemini API key cannot access Google Photos. Use a
                    separate OAuth client.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        update(
                          await request("config", { clientId, clientSecret }),
                        );
                        setClientSecret("");
                        setClientId("");
                        setSetup(false);
                        setAuthUrl("");
                      });
                    }}
                  >
                    <label className="field-label">
                      OAuth client ID
                      <input
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        placeholder="…apps.googleusercontent.com"
                        autoComplete="off"
                        required
                      />
                    </label>
                    <label className="field-label">
                      OAuth client secret
                      <input
                        type="password"
                        value={clientSecret}
                        onChange={(e) => setClientSecret(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </label>
                    <button
                      className="button secondary"
                      disabled={working || importing}
                      type="submit"
                    >
                      Save connection settings
                    </button>
                  </form>
                  <p className="field-note">
                    Saved only in Cutroom’s private local data folder.{" "}
                    <a
                      href="/docs/GOOGLE-PHOTOS.md"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Setup details
                    </a>
                  </p>
                </section>
              )}
              {state.configured && !state.connected && (
                <div className="google-photos-actions">
                  {authUrl ? (
                    <a
                      className="button primary"
                      href={authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Continue with Google <ExternalLink size={14} />
                    </a>
                  ) : (
                    <button
                      className="button primary"
                      disabled={working}
                      onClick={() =>
                        act(async () =>
                          setAuthUrl((await request("oauth/start", {})).url),
                        )
                      }
                    >
                      Connect Google Photos
                    </button>
                  )}
                  <p className="field-note">
                    Sign into the account containing your photos. Google will
                    ask you to allow access to items you select.
                  </p>
                </div>
              )}
              {state.connected && (
                <>
                  <div className="google-photos-actions">
                    <button
                      className="button primary"
                      disabled={working || importing}
                      onClick={() =>
                        act(async () => update(await request("sessions", {})))
                      }
                    >
                      {session
                        ? "Choose a new selection"
                        : "Choose photos & videos"}
                    </button>
                    {session && !expired && (
                      <a
                        className="button secondary"
                        href={session.pickerUri}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open Google Photos picker <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  {session && (
                    <p className="field-note" role="status">
                      {session.ready
                        ? "Selection received. Import it into Cutroom when you are ready."
                        : expired
                          ? "The selection session timed out. Choose a new selection."
                          : "Open the picker, select your photos, and click Done. Cutroom will detect your selection automatically."}
                    </p>
                  )}
                  {session?.ready && (
                    <button
                      className="button primary full-width"
                      disabled={working || importing || busy}
                      onClick={() =>
                        act(async () => update(await request("import", {})))
                      }
                    >
                      {importing ? (
                        <LoaderCircle className="spin" size={15} />
                      ) : (
                        <CloudDownload size={15} />
                      )}{" "}
                      {importing
                        ? "Importing selected moments…"
                        : "Import selected moments"}
                    </button>
                  )}
                  {busy && session?.ready && (
                    <p className="field-note">
                      Your selection is ready. Wait for the current edit to
                      finish before importing.
                    </p>
                  )}
                </>
              )}
              {state.job && (
                <div className="google-photos-result" role="status">
                  <strong>
                    {importing
                      ? `Importing ${state.job.completed} of ${state.job.total}…`
                      : state.job.status === "failed"
                        ? "Import needs attention"
                        : `${state.job.added} added · ${state.job.skipped} already in your library`}
                  </strong>
                  {state.job.errors?.length > 0 && (
                    <ul>
                      {state.job.errors.map((e, i) => (
                        <li key={i}>
                          {e.name}: {e.error}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="field-note">
                Only explicitly selected media is accessed. Google originals
                stay unchanged. Imported files are cached locally; videos must
                be 0.5–120 seconds and each item under 250 MB. Google supplies
                transcoded video downloads.
              </p>
              {state.configured && (
                <div className="google-photos-footer">
                  <button
                    disabled={working || importing}
                    onClick={() => setSetup(!setup)}
                  >
                    {setup ? "Hide setup" : "Connection settings"}
                  </button>
                  {state.connected && (
                    <button
                      disabled={working || importing}
                      onClick={() =>
                        act(async () => {
                          const next = await request("disconnect", {});
                          update(next);
                          setAuthUrl("");
                          if (!next.revoked)
                            setError(
                              "Disconnected locally. Google could not confirm revocation; remove Cutroom access in your Google Account if needed.",
                            );
                        })
                      }
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </dialog>
      )}
    </>
  );
}
