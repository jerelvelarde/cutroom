import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  chmod,
  rm,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { z } from "zod";
import { ROOT, ASSETS, readStore, writeStore } from "./store.mjs";
import { ingestAsset } from "./media.mjs";
import { localDate } from "./stories.mjs";

export const PHOTOS_SCOPE =
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly";
const API = "https://photospicker.googleapis.com/v1";
const credentialsSchema = z.object({
  clientId: z
    .string()
    .trim()
    .max(250)
    .regex(/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/),
  clientSecret: z.string().trim().min(8).max(300),
});
const MAX_FILE = 250 * 1024 * 1024;
export function mediaDownloadUrl(base, type) {
  const u = new URL(base);
  if (
    u.protocol !== "https:" ||
    !(
      u.hostname === "googleusercontent.com" ||
      u.hostname.endsWith(".googleusercontent.com")
    ) ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443")
  )
    throw new Error("Google Photos returned an unsupported media host.");
  return `${u.href}=${type === "VIDEO" ? "dv" : "d"}`;
}
export const pollingMilliseconds = (value) =>
  /^\d+(\.\d+)?s$/.test(value || "") ? Number(value.slice(0, -1)) * 1000 : 5000;
const equal = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const safeName = (item) =>
  path
    .basename(
      String(
        item.mediaFile?.filename ||
          (item.type === "VIDEO"
            ? "Google Photos video.mp4"
            : "Google Photos photo.jpg"),
      ),
    )
    .slice(0, 200);
const mimeExtensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-m4v": ".m4v",
};

export function createGooglePhotos({
  root = ROOT,
  assetsDir = ASSETS,
  fetchImpl = fetch,
  read = readStore,
  write = writeStore,
  ingest = ingestAsset,
  now = Date.now,
  env = process.env,
} = {}) {
  const secretFile = path.join(root, "google-photos-private.json");
  let saved = {},
    session = null,
    job = null,
    pending = null,
    refreshPromise = null,
    saveQueue = Promise.resolve();
  const configured = () => ({
    clientId: env.GOOGLE_PHOTOS_CLIENT_ID || saved.clientId,
    clientSecret: env.GOOGLE_PHOTOS_CLIENT_SECRET || saved.clientSecret,
  });
  function persist() {
    const snapshot = JSON.stringify(saved);
    saveQueue = saveQueue
      .catch(() => {})
      .then(async () => {
        await mkdir(root, { recursive: true });
        await writeFile(`${secretFile}.tmp`, snapshot, { mode: 0o600 });
        await chmod(`${secretFile}.tmp`, 0o600);
        await rename(`${secretFile}.tmp`, secretFile);
      });
    return saveQueue;
  }
  async function init() {
    try {
      saved = JSON.parse(await readFile(secretFile, "utf8"));
      await chmod(secretFile, 0o600);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  function status() {
    const c = configured();
    return {
      configured: Boolean(c.clientId && c.clientSecret),
      connected: Boolean(
        saved.token?.refresh_token ||
        (saved.token?.access_token && saved.token.expiresAt > now()),
      ),
      session: session
        ? {
            id: session.id,
            pickerUri: session.pickerUri,
            ready: Boolean(session.mediaItemsSet),
            expiresAt: session.expireTime,
            nextPollAt: session.nextPollAt,
            stopPollingAt: session.stopPollingAt,
          }
        : null,
      job,
    };
  }
  function guard() {
    if (job?.status === "importing")
      throw new Error("Wait for the Google Photos import to finish.");
  }
  async function configure(input) {
    guard();
    const c = credentialsSchema.parse(input);
    saved = { ...c };
    session = null;
    pending = null;
    await persist();
    return status();
  }
  async function tokenRequest(body) {
    const res = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(
        data.error === "invalid_grant"
          ? "Google Photos authorization expired. Connect again."
          : "Google could not authorize this connection. Check the OAuth client and redirect URI.",
      );
    if (!data.access_token)
      throw new Error("Google did not return an access token.");
    if (data.scope && !data.scope.split(" ").includes(PHOTOS_SCOPE))
      throw new Error(
        "Google Photos permission was not granted. Connect again and allow the picker permission.",
      );
    return data;
  }
  async function accessToken() {
    if (saved.token?.access_token && saved.token.expiresAt > now() + 60000)
      return saved.token.access_token;
    if (!saved.token?.refresh_token)
      throw new Error("Connect Google Photos first.");
    refreshPromise ||= (async () => {
      try {
        const c = configured();
        const data = await tokenRequest({
          client_id: c.clientId,
          client_secret: c.clientSecret,
          grant_type: "refresh_token",
          refresh_token: saved.token.refresh_token,
        });
        saved.token = {
          ...saved.token,
          ...data,
          expiresAt: now() + Number(data.expires_in || 3600) * 1000,
        };
        await persist();
        return saved.token.access_token;
      } catch (e) {
        delete saved.token;
        await persist();
        throw e;
      } finally {
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  }
  function beginAuth(redirectUri) {
    guard();
    const c = configured();
    if (!c.clientId || !c.clientSecret)
      throw new Error("Configure a Google OAuth web client first.");
    const state = randomBytes(32).toString("hex"),
      verifier = randomBytes(48).toString("base64url");
    pending = { state, verifier, redirectUri, expiresAt: now() + 600000 };
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.search = new URLSearchParams({
      client_id: c.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: PHOTOS_SCOPE,
      access_type: "offline",
      prompt: "consent select_account",
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return { url: u.href, state };
  }
  async function completeAuth({ state, code, cookie, error }) {
    const request = pending;
    pending = null;
    if (
      !request ||
      request.expiresAt < now() ||
      !equal(state, request.state) ||
      !equal(cookie, request.state)
    )
      throw new Error(
        "The Google sign-in session expired or did not match this browser. Start again from Cutroom.",
      );
    if (error)
      throw new Error(
        "Google Photos access was not granted. You can try connecting again.",
      );
    const c = configured();
    const data = await tokenRequest({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      redirect_uri: request.redirectUri,
      grant_type: "authorization_code",
      code: z.string().min(1).max(4096).parse(code),
      code_verifier: request.verifier,
    });
    saved.token = {
      ...data,
      expiresAt: now() + Number(data.expires_in || 3600) * 1000,
    };
    session = null;
    await persist();
    return status();
  }
  async function request(route, options = {}) {
    const res = await fetchImpl(`${API}${route}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      if (res.status === 401) {
        delete saved.token;
        await persist();
        throw new Error("Google Photos authorization expired. Connect again.");
      }
      if (res.status === 403)
        throw new Error(
          "Google Photos access was denied. Enable the Photos Picker API and check your OAuth consent/test-user settings.",
        );
      if (res.status === 404 || res.status === 410)
        throw new Error("This photo selection expired. Choose photos again.");
      if (res.status === 429)
        throw new Error("Google Photos is busy. Wait a moment and try again.");
      throw new Error(
        `Google Photos request failed (${res.status}). Try choosing your photos again.`,
      );
    }
    return res.status === 204 ? {} : res.json();
  }
  function remember(data) {
    const old = session;
    const timeout = pollingMilliseconds(data.pollingConfig?.timeoutIn);
    session = {
      ...data,
      nextPollAt:
        now() +
        Math.max(1000, pollingMilliseconds(data.pollingConfig?.pollInterval)),
      stopPollingAt: Math.min(
        old?.id === data.id ? old.stopPollingAt : Infinity,
        now() + timeout,
        Date.parse(data.expireTime) || Infinity,
      ),
    };
    return status();
  }
  async function clearSession() {
    if (session) {
      await request(`/sessions/${encodeURIComponent(session.id)}`, {
        method: "DELETE",
      }).catch(() => {});
      session = null;
    }
  }
  async function createSession() {
    guard();
    const existing = await read("assets");
    const room = 100 - existing.filter((a) => a.kind !== "fixture").length;
    if (room < 1)
      throw new Error(
        "This library already contains 100 items. Choose a smaller local library before importing.",
      );
    await clearSession();
    const data = await request("/sessions", {
      method: "POST",
      body: JSON.stringify({ pickingConfig: { maxItemCount: String(room) } }),
    });
    const uri = new URL(data.pickerUri);
    if (uri.protocol !== "https:" || uri.hostname !== "photos.google.com")
      throw new Error("Google returned an unexpected picker address.");
    return remember(data);
  }
  async function poll() {
    if (!session) throw new Error("Choose photos first.");
    if (session.mediaItemsSet) return status();
    if (now() < session.nextPollAt) return status();
    if (now() > session.stopPollingAt)
      throw new Error("Photo selection timed out. Choose photos again.");
    return remember(
      await request(`/sessions/${encodeURIComponent(session.id)}`),
    );
  }
  async function disconnect() {
    guard();
    await clearSession();
    const token = saved.token?.refresh_token || saved.token?.access_token;
    let revoked = !token;
    if (token) {
      try {
        const res = await fetchImpl("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
          signal: AbortSignal.timeout(15000),
        });
        revoked = res.ok;
      } catch {}
    }
    delete saved.token;
    pending = null;
    await persist();
    return { ...status(), revoked };
  }
  async function download(item, file, budget) {
    let url = mediaDownloadUrl(item.mediaFile?.baseUrl, item.type),
      res;
    for (let i = 0; i < 4; i++) {
      res = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${await accessToken()}` },
        redirect: "manual",
        signal: AbortSignal.timeout(120000),
      });
      if (res.status >= 300 && res.status < 400) {
        const next = new URL(res.headers.get("location"), url);
        mediaDownloadUrl(next.href, item.type);
        url = next.href;
        await res.body?.cancel();
        continue;
      }
      break;
    }
    if (!res?.ok || !res.body)
      throw new Error(
        "Google could not download this item. Try selecting it again.",
      );
    const contentType = res.headers.get("content-type")?.split(";")[0];
    const ext =
      mimeExtensions[contentType] || mimeExtensions[item.mediaFile?.mimeType];
    if (!ext) throw new Error("This photo or video format is not supported.");
    const length = Number(res.headers.get("content-length"));
    if (length > MAX_FILE || length > budget.remaining) {
      await res.body.cancel();
      throw new Error(
        "Downloads are limited to 250 MB per item and 2 GB per import.",
      );
    }
    let bytes = 0;
    const limit = new Transform({
      transform(chunk, _enc, cb) {
        bytes += chunk.length;
        budget.remaining -= chunk.length;
        if (bytes > MAX_FILE || budget.remaining < 0)
          cb(
            new Error(
              "Downloads are limited to 250 MB per item and 2 GB per import.",
            ),
          );
        else cb(null, chunk);
      },
    });
    const output = `${file}${ext}`;
    await pipeline(
      Readable.fromWeb(res.body),
      limit,
      createWriteStream(output, { flags: "wx", mode: 0o600 }),
    );
    return output;
  }
  async function importPicked() {
    guard();
    if (!session?.mediaItemsSet)
      throw new Error("Finish choosing photos in Google Photos first.");
    const selectionId = session.id;
    job = {
      id: randomUUID(),
      status: "importing",
      completed: 0,
      total: 0,
      added: 0,
      skipped: 0,
      errors: [],
    };
    try {
      const items = [];
      let pageToken = "";
      do {
        const q = new URLSearchParams({
          sessionId: selectionId,
          pageSize: "100",
        });
        if (pageToken) q.set("pageToken", pageToken);
        const data = await request(`/mediaItems?${q}`);
        items.push(...(data.mediaItems || []));
        if (items.length > 100)
          throw new Error("Choose no more than 100 photos and clips.");
        pageToken = data.nextPageToken || "";
      } while (pageToken);
      const existing = await read("assets"),
        known = new Set(
          existing.filter((a) => a.googlePhotosId).map((a) => a.googlePhotosId),
        );
      const unique = items.filter((a) => !known.has(a.id));
      if (
        existing.filter((a) => a.kind !== "fixture").length + unique.length >
        100
      )
        throw new Error(
          "This import would exceed the 100-item library limit. Choose fewer items.",
        );
      job.total = items.length;
      const budget = { remaining: 2 * 1024 * 1024 * 1024 };
      for (const item of items) {
        if (known.has(item.id)) {
          job.skipped++;
          job.completed++;
          continue;
        }
        const id = randomUUID(),
          dir = path.join(assetsDir, id);
        await mkdir(dir, { recursive: true });
        try {
          if (!["PHOTO", "VIDEO"].includes(item.type))
            throw new Error("Unsupported media type.");
          if (
            item.type === "VIDEO" &&
            item.mediaFile?.mediaFileMetadata?.videoMetadata
              ?.processingStatus !== "READY"
          )
            throw new Error(
              "Google is still processing this video. Pick it again once ready.",
            );
          const file = await download(item, path.join(dir, "original"), budget);
          const asset = await ingest({
            id,
            file,
            name: safeName(item),
            kind: "google_photos",
          });
          asset.googlePhotosId = item.id;
          asset.googlePhotosImportedAt = new Date(now()).toISOString();
          if (item.createTime && Number.isFinite(Date.parse(item.createTime))) {
            asset.captureDate = localDate(item.createTime);
            asset.dateSource = "Google Photos capture time";
          }
          await write("assets", [...existing, asset]);
          existing.push(asset);
          known.add(item.id);
          job.added++;
        } catch (e) {
          await rm(dir, { recursive: true, force: true });
          job.errors.push({ name: safeName(item), error: e.message });
        }
        job.completed++;
      }
      job.status = job.errors.length ? "completed_with_errors" : "complete";
      if (!job.errors.length) await clearSession();
    } catch (e) {
      job.status = "failed";
      job.errors.push({ name: "Import", error: e.message });
    }
    return job;
  }
  return {
    init,
    status,
    configure,
    beginAuth,
    completeAuth,
    createSession,
    poll,
    disconnect,
    importPicked,
  };
}
