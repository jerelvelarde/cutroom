import express from "express";
import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { z } from "zod";
import {
  initStore,
  readStore,
  writeStore,
  ASSETS,
  EXPORTS,
  publicAsset,
} from "./store.mjs";
import { ingestAsset, command } from "./media.mjs";
import { createFixtures } from "./fixtures.mjs";
import {
  loadRuns,
  listRuns,
  startRun,
  findRun,
  publicRun,
  cancelRun,
  hasActiveRun,
  reviseRun,
} from "./agent.mjs";
import { Gemini, MODEL, AGENT, outputText } from "./gemini.mjs";
import { eligibleAssets, localDate } from "./stories.mjs";
import {
  browseFolders,
  assertSourceAvailable,
  saveExport,
} from "./local-files.mjs";
import { generateStoryboard } from "./storyboard.mjs";
import { chatEndpoint } from "./chat.mjs";
import { registerVoiceoverRoutes } from "./voiceover.mjs";
import { validateTimeline } from "./timeline.mjs";
import { indexFolder } from "./source-folder.mjs";
import { mountGooglePhotos } from "./google-photos-routes.mjs";

await initStore();
await loadRuns();
const app = express();
const port = Number(process.env.PORT || 4317);
let apiKey = process.env.GEMINI_API_KEY || "";
let verified = false,
  autoEdit = false,
  ingesting = false;
app.disable("x-powered-by");
// Local single-user app. Reject remote Host headers and cross-origin writes.
app.use((req, res, next) => {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(req.hostname))
    return res
      .status(403)
      .json({ error: "Cutroom accepts local connections only." });
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    req.headers.origin !== `http://${req.headers.host}`
  )
    return res
      .status(403)
      .json({ error: "Cross-origin writes are not permitted." });
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "512kb" }));
registerVoiceoverRoutes(app);
await mountGooglePhotos(app, {
  port,
  beginImport: () => {
    if (ingesting || hasActiveRun())
      throw new Error("Wait for the current import or edit to finish.");
    ingesting = true;
  },
  endImport: () => {
    ingesting = false;
  },
});
app.post(
  "/api/copilot",
  chatEndpoint(() => apiKey, {
    launch: async (body) => {
      if (ingesting) throw new Error("Wait for the current import to finish.");
      return launch(body, await readStore("assets"));
    },
  }),
);
let planning = false;
app.get("/api/storyboard", async (_req, res) =>
  res.json(await readStore("storyboard", null)),
);
app.post("/api/storyboard", async (req, res) => {
  if (planning)
    return res
      .status(409)
      .json({ error: "A storyboard is already being generated." });
  planning = true;
  try {
    const feedback = z.string().max(3000).default("").parse(req.body.feedback);
    res.json(
      await generateStoryboard({
        key: apiKey,
        feedback,
        signal: AbortSignal.timeout(180000),
      }),
    );
  } finally {
    planning = false;
  }
});
app.use(
  "/docs",
  express.static(path.resolve("docs"), {
    setHeaders: (res) => res.set("Content-Type", "text/plain; charset=utf-8"),
  }),
);
app.use("/media/assets", express.static(ASSETS, { dotfiles: "deny" }));
app.use("/media/exports", express.static(EXPORTS, { dotfiles: "deny" }));
const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, file, cb) => {
      try {
        file.assetId = randomUUID();
        const dir = path.join(ASSETS, file.assetId);
        await mkdir(dir, { recursive: true });
        cb(null, dir);
      } catch (e) {
        cb(e);
      }
    },
    filename: (_req, file, cb) =>
      cb(null, `original${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { files: 100, fileSize: 250 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /\.(mp4|mov|m4v|webm|jpe?g|png|webp|heic|heif)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(
          new Error(
            "Choose JPEG, PNG, WebP, HEIC photos or MP4, MOV, M4V, WebM videos.",
          ),
        ),
});
const state = () => ({
  configured: Boolean(apiKey),
  verified,
  autoEdit,
  model: MODEL,
  agent: AGENT,
});
app.get("/api/config", (_req, res) => res.json(state()));
app.post("/api/config", (req, res) => {
  if (hasActiveRun())
    return res.status(409).json({
      error: "Wait for the current run before changing the connection.",
    });
  if (typeof req.body.apiKey === "string") {
    apiKey = req.body.apiKey.trim();
    verified = false;
  }
  if (typeof req.body.autoEdit === "boolean") autoEdit = req.body.autoEdit;
  res.json(state());
});
app.post("/api/config/verify", async (_req, res) => {
  if (!apiKey)
    return res.status(400).json({ error: "Add your Gemini API key first." });
  const client = new Gemini(apiKey, AbortSignal.timeout(120000));
  await client.interact({
    model: MODEL,
    input: "Reply with OK only.",
    generation_config: { max_output_tokens: 128 },
    store: false,
  });
  const agent = await client.interact({
    agent: AGENT,
    agent_config: { type: "antigravity", model: MODEL },
    environment: "remote",
    input: "Reply with OK only. Do not use tools.",
  });
  if (!outputText(agent))
    throw new Error("Managed agent returned no confirmation.");
  verified = true;
  res.json(state());
});
app.get("/api/health", async (_req, res) => {
  const checks = await Promise.allSettled(
    ["ffmpeg", "ffprobe"].map((program) =>
      command(program, ["-version"], { timeout: 5000 }),
    ),
  );
  res.json({
    ok: checks.every((c) => c.status === "fulfilled"),
    ffmpeg: checks[0].status === "fulfilled",
    ffprobe: checks[1].status === "fulfilled",
  });
});
app.get("/api/assets", async (_req, res) =>
  res.json((await readStore("assets")).map(publicAsset)),
);
app.get("/api/source", async (_req, res) =>
  res.json(await readStore("source", null)),
);
app.post("/api/folders", async (req, res) =>
  res.json(await browseFolders(req.body.path || undefined)),
);
app.post("/api/source", async (req, res) => {
  if (ingesting || hasActiveRun())
    return res
      .status(409)
      .json({ error: "Wait for the current import or edit to finish." });
  ingesting = true;
  try {
    const result = await indexFolder(
      z.string().min(1).parse(req.body.path),
      await readStore("assets"),
    );
    await writeStore("assets", result.assets);
    await writeStore("source", result.folder);
    res.json({ folder: result.folder, errors: result.errors });
  } finally {
    ingesting = false;
  }
});
app.patch("/api/assets/:id", async (req, res) => {
  if (ingesting || hasActiveRun())
    return res
      .status(409)
      .json({ error: "Wait for the current operation before changing dates." });
  const date = z.iso.date().nullable().parse(req.body.captureDate);
  const assets = await readStore("assets");
  const asset = assets.find((a) => a.id === req.params.id);
  if (!asset) return res.status(404).json({ error: "Asset not found." });
  asset.captureDate = date;
  asset.dateSource = date ? "set by you" : "unknown";
  await writeStore("assets", assets);
  res.json(publicAsset(asset));
});

async function launch(body, assets) {
  const duplicate =
    body.requestId && listRuns().find((r) => r.requestId === body.requestId);
  if (duplicate) return duplicate;
  const request = z
    .object({
      requestId: z.string().max(100).optional(),
      brief: z.string().max(2000).default(""),
      targetDuration: z.number().int().min(6).max(60).default(30),
      assetIds: z.array(z.string()).max(100).optional(),
      mode: z.enum(["managed", "practice"]).default("managed"),
      storyMode: z.enum(["discover", "today", "week"]).default("discover"),
      startDate: z.iso.date().optional(),
      endDate: z.iso.date().optional(),
    })
    .parse(body);
  if (request.storyMode === "today") {
    request.startDate ||= localDate();
    request.endDate = request.startDate;
  }
  if (request.mode === "managed" && !apiKey)
    throw new Error("Connect your Gemini account before starting the editor.");
  const candidates =
    request.mode === "practice"
      ? assets.filter((a) => a.kind === "fixture")
      : eligibleAssets(assets, request);
  const selected = candidates.filter(
    (a) => !request.assetIds || request.assetIds.includes(a.id),
  );
  if (selected.length === 0)
    throw new Error(
      request.storyMode === "discover"
        ? "Add photos or videos to your library first."
        : "No assets match this date range. Check capture dates in the gallery, or use Find a story.",
    );
  if (request.assetIds?.some((id) => !assets.some((a) => a.id === id)))
    throw new Error("One or more selected assets are no longer available.");
  if (
    selected.length > 100 ||
    selected
      .filter((a) => a.mediaType !== "photo")
      .reduce((sum, a) => sum + a.duration, 0) > 600
  )
    throw new Error(
      "One run supports up to 100 assets and at most 10 minutes of source video.",
    );
  await Promise.all(selected.map(assertSourceAvailable));
  return startRun(
    { ...request, assetIds: selected.map((a) => a.id) },
    selected,
    apiKey,
  );
}
app.post("/api/assets", (req, res, next) => {
  if (ingesting || hasActiveRun())
    return res
      .status(409)
      .json({ error: "Wait for the current import or edit to finish." });
  ingesting = true;
  if (Number(req.headers["content-length"] || 0) > 2 * 1024 * 1024 * 1024) {
    ingesting = false;
    return res
      .status(413)
      .json({ error: "Import batches are limited to 2 GB." });
  }
  upload.array("files", 100)(req, res, async (error) => {
    if (error) {
      ingesting = false;
      return next(error);
    }
    const errors = [],
      added = [];
    try {
      const existing = await readStore("assets");
      if (
        existing.filter((a) => a.kind !== "fixture").length +
          (req.files || []).length >
        100
      ) {
        await Promise.all(
          (req.files || []).map((file) => unlink(file.path).catch(() => {})),
        );
        throw new Error(
          "This hackathon library supports up to 100 personal assets.",
        );
      }
      for (const file of req.files || []) {
        try {
          added.push(
            await ingestAsset({
              id: file.assetId,
              file: file.path,
              name: path.basename(file.originalname),
            }),
          );
        } catch (e) {
          await unlink(file.path).catch(() => {});
          errors.push({ name: file.originalname, error: e.message });
        }
      }
      const assets = [...existing, ...added];
      await writeStore("assets", assets);
      let run = null,
        autoEditError = null;
      if (apiKey && autoEdit && added.length) {
        try {
          run = await launch(
            {
              assetIds: added.map((a) => a.id),
              storyMode: req.body.storyMode || "discover",
              startDate: req.body.startDate || undefined,
              endDate: req.body.endDate || undefined,
              targetDuration: Number(req.body.targetDuration || 30),
            },
            assets,
          );
        } catch (e) {
          autoEditError = e.message;
        }
      }
      res.status(added.length ? 201 : 400).json({
        assets: added.map(publicAsset),
        errors,
        run,
        autoEditError,
        error: !added.length
          ? errors[0]?.error || "Choose at least one video."
          : undefined,
      });
    } catch (e) {
      next(e);
    } finally {
      ingesting = false;
    }
  });
});
app.post("/api/fixtures", async (_req, res) => {
  if (ingesting || hasActiveRun())
    return res.status(409).json({ error: "Wait for the current operation." });
  ingesting = true;
  try {
    const existing = await readStore("assets");
    if (existing.filter((a) => a.kind === "fixture").length === 3)
      return res.json(
        existing.filter((a) => a.kind === "fixture").map(publicAsset),
      );
    const fixtures = await createFixtures();
    await writeStore("assets", [
      ...existing.filter((a) => a.kind !== "fixture"),
      ...fixtures,
    ]);
    res.json(fixtures.map(publicAsset));
  } finally {
    ingesting = false;
  }
});
app.get("/api/runs", (_req, res) => res.json(listRuns()));
app.get("/api/runs/:id", (req, res) => {
  const run = findRun(req.params.id);
  res
    .status(run ? 200 : 404)
    .json(run ? publicRun(run) : { error: "Run not found." });
});
app.post("/api/runs", async (req, res) => {
  if (ingesting)
    return res.status(409).json({ error: "Wait for the import to finish." });
  res.status(201).json(await launch(req.body, await readStore("assets")));
});
app.post("/api/runs/:id/revise", async (req, res) => {
  if (ingesting) throw new Error("Wait for the folder scan to finish.");
  const body = z
    .object({
      feedback: z.string().min(1).max(3000),
      version: z.number().int().positive().optional(),
      targetDuration: z.number().min(6).max(60).optional(),
      selectedClip: z.number().int().min(0).max(11).nullable().optional(),
      plan: z.any().optional(),
      requestId: z.string().max(100).optional(),
    })
    .parse(req.body);
  if (body.plan)
    body.plan = validateTimeline(
      body.plan,
      await readStore("assets"),
      body.targetDuration,
    );
  res
    .status(201)
    .json(await reviseRun({ ...body, parentRunId: req.params.id }, apiKey));
});
app.post("/api/runs/:id/export", async (req, res) => {
  const run = findRun(req.params.id);
  const version = run?.versions.find(
    (v) => String(v.id) === String(req.body.version),
  );
  if (!version)
    return res.status(404).json({ error: "Rendered version not found." });
  res.json(
    await saveExport(version.file, z.string().min(1).parse(req.body.path)),
  );
});
app.post("/api/runs/:id/cancel", (req, res) =>
  res.json({ cancelled: cancelRun(req.params.id) }),
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found." }),
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.resolve("dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.resolve("dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      fs: {
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem}",
          "**/.git/**",
          "**/.cutroom/**",
          "**/*-private.json*",
        ],
      },
      watch: { ignored: ["**/.cutroom/**"] },
      hmr: { port: port + 1, host: "127.0.0.1" },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.use((error, _req, res, _next) => {
  const message =
    error instanceof z.ZodError
      ? error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      : error.message;
  res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
    error: apiKey ? String(message).split(apiKey).join("[redacted]") : message,
  });
});
const server = app.listen(port, "127.0.0.1");
server.once("listening", () =>
  console.log(`Cutroom is ready at http://127.0.0.1:${port}`),
);
server.once("error", (error) => {
  console.error(`Cutroom could not start: ${error.message}`);
  process.exit(1);
});
