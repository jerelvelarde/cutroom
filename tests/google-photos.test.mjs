import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  mkdir,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
const root = await mkdtemp(path.join(tmpdir(), "cutroom-google-photos-"));
process.env.CUTROOM_DATA_DIR = root;
const {
  createGooglePhotos,
  PHOTOS_SCOPE,
  mediaDownloadUrl,
  pollingMilliseconds,
} = await import("../server/google-photos.mjs");
const { indexFolder } = await import("../server/source-folder.mjs");
const { validateTimeline } = await import("../server/timeline.mjs");
after(() => rm(root, { recursive: true, force: true }));
const config = {
  clientId: "test-client.apps.googleusercontent.com",
  clientSecret: "fixture-client-secret",
};
const photo = await sharp({
  create: { width: 80, height: 100, channels: 3, background: "#326ba8" },
})
  .jpeg()
  .toBuffer();
const item = {
  id: "picked-photo-1",
  type: "PHOTO",
  createTime: "2026-10-25T19:00:00Z",
  mediaFile: {
    baseUrl: "https://lh3.googleusercontent.com/p/selected",
    mimeType: "image/jpeg",
    filename: "../picked-moment.jpg",
  },
};
const json = (data) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
function harness({ mediaResponse } = {}) {
  let time = 1000000,
    assets = [
      { id: "existing-local", kind: "linked", name: "SSD original.mov" },
    ],
    picked = false,
    tokenRefreshes = 0;
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    url = String(url);
    calls.push({ url, options });
    if (url === "https://oauth2.googleapis.com/token") {
      if (options.body.get("grant_type") === "refresh_token") tokenRefreshes++;
      return json({
        access_token: "fixture-access-token",
        refresh_token: "fixture-refresh-token",
        expires_in: 3600,
        scope: PHOTOS_SCOPE,
      });
    }
    if (url === "https://oauth2.googleapis.com/revoke")
      return new Response(null, { status: 200 });
    if (url === "https://photospicker.googleapis.com/v1/sessions")
      return json({
        id: "picker-session",
        pickerUri: "https://photos.google.com/picker/session",
        expireTime: new Date(time + 600000).toISOString(),
        pollingConfig: { pollInterval: "5s", timeoutIn: "600s" },
        mediaItemsSet: false,
      });
    if (url.endsWith("/sessions/picker-session")) {
      if (options.method === "DELETE")
        return new Response(null, { status: 204 });
      return json({
        id: "picker-session",
        pickerUri: "https://photos.google.com/picker/session",
        expireTime: new Date(time + 600000).toISOString(),
        mediaItemsSet: picked,
        pollingConfig: { pollInterval: "5s", timeoutIn: "600s" },
      });
    }
    if (url.startsWith("https://photospicker.googleapis.com/v1/mediaItems?"))
      return json({ mediaItems: [item] });
    if (url === "https://lh3.googleusercontent.com/p/selected=d")
      return mediaResponse
        ? mediaResponse()
        : new Response(photo, { headers: { "Content-Type": "image/jpeg" } });
    throw new Error("Unexpected network destination: " + url);
  };
  const client = createGooglePhotos({
    root: path.join(root, Math.random().toString(36).slice(2)),
    fetchImpl,
    read: async () => assets,
    write: async (_name, next) => {
      assets = structuredClone(next);
    },
    now: () => time,
    env: {},
  });
  return {
    client,
    calls,
    get assets() {
      return assets;
    },
    get tokenRefreshes() {
      return tokenRefreshes;
    },
    advance: (ms) => {
      time += ms;
    },
    pick: () => {
      picked = true;
    },
  };
}
async function authorize(h) {
  await h.client.init();
  await h.client.configure(config);
  const auth = h.client.beginAuth(
    "http://127.0.0.1:4317/api/google-photos/oauth/callback",
  );
  await h.client.completeAuth({
    state: auth.state,
    cookie: auth.state,
    code: "fixture-authorization-code",
  });
  return auth;
}
async function choose(h) {
  await h.client.createSession();
  h.pick();
  h.advance(5001);
  await h.client.poll();
}

test("OAuth binds state to browser, uses PKCE and only Picker scope, and hides secrets from status", async () => {
  const h = harness();
  await h.client.init();
  await h.client.configure(config);
  const bad = h.client.beginAuth(
    "http://127.0.0.1:4317/api/google-photos/oauth/callback",
  );
  await assert.rejects(
    h.client.completeAuth({
      state: bad.state,
      cookie: "different-browser",
      code: "code",
    }),
    /did not match/,
  );
  assert.equal(
    h.calls.length,
    0,
    "Invalid state must not reach token endpoint.",
  );
  const auth = await authorize(h);
  const url = new URL(auth.url);
  assert.equal(url.searchParams.get("scope"), PHOTOS_SCOPE);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.ok(url.searchParams.get("code_challenge"));
  const exchange = h.calls.find((c) => c.url.endsWith("/token"));
  assert.ok(exchange.options.body.get("code_verifier"));
  assert.equal(h.client.status().connected, true);
  const visible = JSON.stringify(h.client.status());
  assert.equal(visible.includes("fixture-"), false);
});

test("picker honors polling interval; selected photo downloads through authorized host and enters real media pipeline", async () => {
  const h = harness();
  await authorize(h);
  await h.client.createSession();
  const count = h.calls.length;
  await h.client.poll();
  assert.equal(h.calls.length, count);
  h.pick();
  h.advance(5001);
  await h.client.poll();
  assert.equal(h.client.status().session.ready, true);
  const result = await h.client.importPicked();
  assert.equal(result.status, "complete");
  assert.equal(result.added, 1);
  assert.equal(h.assets[0].id, "existing-local");
  const asset = h.assets[1];
  assert.equal(asset.kind, "google_photos");
  assert.equal(asset.name, "picked-moment.jpg");
  assert.equal(asset.captureDate, "2026-10-25");
  assert.equal(asset.dateSource, "Google Photos capture time");
  assert.ok((await stat(asset.thumbnail)).size > 0);
  assert.deepEqual(await readFile(asset.originalFile), photo);
  assert.equal(
    validateTimeline(
      {
        title: "Imported photo",
        clips: [{ assetId: asset.id, start: 0, end: 6 }],
      },
      h.assets,
      6,
    ).duration,
    6,
  );
  const media = h.calls.find((c) => c.url.includes("lh3.googleusercontent"));
  assert.equal(
    media.options.headers.Authorization,
    "Bearer fixture-access-token",
  );
  assert.equal(h.client.status().session, null);
  await choose(h);
  const repeated = await h.client.importPicked();
  assert.equal(repeated.added, 0);
  assert.equal(repeated.skipped, 1);
  assert.equal(h.assets.length, 2);
  const folder = path.join(root, "new-ssd-folder");
  await mkdir(folder);
  await writeFile(path.join(folder, "other.jpg"), photo);
  const indexed = await indexFolder(folder, h.assets);
  assert.ok(
    indexed.assets.some((a) => a.id === asset.id),
    "Rescanning/switching SSD retains selected Google imports.",
  );
});

test("refreshes expired tokens, revokes on disconnect, and rejects expired OAuth callbacks", async () => {
  const h = harness();
  await authorize(h);
  h.advance(3600000);
  await h.client.createSession();
  assert.equal(h.tokenRefreshes, 1);
  const disconnected = await h.client.disconnect();
  assert.equal(disconnected.connected, false);
  assert.equal(disconnected.revoked, true);
  const auth = h.client.beginAuth(
    "http://127.0.0.1:4317/api/google-photos/oauth/callback",
  );
  h.advance(600001);
  await assert.rejects(
    h.client.completeAuth({
      state: auth.state,
      cookie: auth.state,
      code: "late",
    }),
    /expired/,
  );
});

test("download boundary rejects hostile hosts, redirects and oversized selected files without replacing library", async () => {
  for (const url of [
    "http://lh3.googleusercontent.com/a",
    "https://googleusercontent.com.evil.test/a",
    "https://127.0.0.1/a",
    "https://u:p@lh3.googleusercontent.com/a",
  ])
    assert.throws(() => mediaDownloadUrl(url, "PHOTO"), /unsupported/);
  assert.equal(
    mediaDownloadUrl("https://lh3.googleusercontent.com/a", "VIDEO"),
    "https://lh3.googleusercontent.com/a=dv",
  );
  assert.equal(pollingMilliseconds("3.5s"), 3500);
  for (const mediaResponse of [
    () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://evil.test/steal" },
      }),
    () =>
      new Response("too large", {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(251 * 1024 * 1024),
        },
      }),
  ]) {
    const h = harness({ mediaResponse });
    await authorize(h);
    await choose(h);
    const result = await h.client.importPicked();
    assert.equal(result.added, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(h.assets.length, 1);
    assert.equal(
      h.calls.some((c) => c.url.includes("evil.test")),
      false,
    );
  }
});
