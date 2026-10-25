import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { mkdir, readFile, writeFile, chmod, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ROOT, EXPORTS, readStore, writeStore, mediaUrl } from "./store.mjs";
import { findRun } from "./agent.mjs";
import { command, ffmpeg, probe } from "./media.mjs";

// The official onboarding CLI writes .env.local. Keep it server-side and optional for fresh clones.
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

export const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // George, ElevenLabs' documented stock voice.
export const DEFAULT_SCRIPT =
  "Today I joined the Gemini Argon hackathon, and I ended up building a tool called Cutroom. It uses Argon to help me proactively edit and organize my shots, starting with the photos and videos already on my SSD. Instead of staring at a camera roll, I can ask: what's the main story today? Argon proposes an angle, arranges the moments, and writes a visual storyboard that explains the sequence. Then I can turn that plan into a reel. The copilot shows the tools it uses, and I can keep giving feedback while I edit. Cutroom also normalizes iPhone HDR footage, helps match colors between shots, and renders a reviewed video locally. Nothing is baked into my originals. I can inspect every cut, adjust the timeline, and export a new version. This is my day at the hackathon, turned into a story, with Cutroom.";
export const voiceInput = z.object({
  text: z.string().trim().min(1).max(3000),
  voiceId: z
    .string()
    .regex(/^[a-zA-Z0-9]{10,80}$/)
    .default(DEFAULT_VOICE),
  speed: z.number().min(0.7).max(1.2).default(1),
});
const outputDir = path.join(ROOT, "voiceovers");
async function audioDuration(file) {
  const { stdout } = await command("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const n = Number(stdout.trim());
  if (!Number.isFinite(n) || n <= 0)
    throw new Error("The generated narration is not playable.");
  return n;
}
export function providerError(status) {
  if (status === 401 || status === 403)
    return "ElevenLabs rejected the API key or voice permission. Check the key and account access.";
  if (status === 429)
    return "ElevenLabs rate or credit limit reached. Check your account and retry.";
  return `ElevenLabs could not generate this narration (${status}). Try again.`;
}
export function createVoiceoverService({
  clientFactory = (apiKey) => new ElevenLabsClient({ apiKey }),
  root = ROOT,
  env = process.env,
} = {}) {
  let saved = {},
    working = false;
  const secret = path.join(root, "elevenlabs-private.json"),
    dir = path.join(root, "voiceovers");
  const ready = (async () => {
    try {
      saved = JSON.parse(await readFile(secret, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await mkdir(dir, { recursive: true });
  })();
  const key = () => env.ELEVENLABS_API_KEY || saved.apiKey || "";
  const state = async () => {
    await ready;
    return {
      configured: Boolean(key()),
      busy: working,
      voiceId: DEFAULT_VOICE,
      voiceName: "George · stock synthetic voice",
      provider: "ElevenLabs",
      defaultScript: DEFAULT_SCRIPT,
    };
  };
  async function configure(input) {
    await ready;
    if (working)
      throw new Error(
        "Wait for the narration to finish before changing its connection.",
      );
    const apiKey = z.string().trim().min(10).max(500).parse(input.apiKey);
    saved = { apiKey };
    await writeFile(`${secret}.tmp`, JSON.stringify(saved), { mode: 0o600 });
    await chmod(`${secret}.tmp`, 0o600);
    await rename(`${secret}.tmp`, secret);
    return state();
  }
  async function generate(input) {
    await ready;
    const body = voiceInput.parse(input);
    if (!key())
      throw new Error("Add an ElevenLabs API key in Voiceover settings first.");
    if (working) throw new Error("A narration is already being generated.");
    if (body.voiceId !== DEFAULT_VOICE)
      throw new Error(
        "This build uses the stock George voice. Custom and cloned voices are not enabled.",
      );
    working = true;
    try {
      let audio;
      try {
        audio = await clientFactory(key()).textToSpeech.convert(
          body.voiceId,
          {
            text: body.text,
            modelId: "eleven_v4",
            outputFormat: "mp3_44100_128",
            voiceSettings: { stability: 0.5, similarityBoost: 0.75 },
          },
          { timeoutInSeconds: 120 },
        );
      } catch (error) {
        throw new Error(providerError(error.statusCode || 502));
      }
      const chunks = [];
      let bytes = 0;
      for await (const chunk of audio) {
        bytes += chunk.length;
        if (bytes > 20 * 1024 * 1024)
          throw new Error(
            "Narration exceeded the 20 MB limit. Use a shorter script.",
          );
        chunks.push(chunk);
      }
      const id = randomUUID(),
        file = path.join(dir, `${id}.mp3`);
      await writeFile(file, Buffer.concat(chunks), { mode: 0o600 });
      if (body.speed !== 1) {
        const adjusted = path.join(dir, `${id}-speed.mp3`);
        await ffmpeg([
          "-i",
          file,
          "-af",
          `atempo=${body.speed}`,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "128k",
          adjusted,
        ]);
        await rename(adjusted, file);
      }
      const duration = await audioDuration(file);
      const item = {
        id,
        provider: "ElevenLabs",
        voiceName: "George",
        voiceId: body.voiceId,
        model: "eleven_v4",
        text: body.text,
        speed: body.speed,
        duration,
        createdAt: new Date().toISOString(),
        url: `/media/voiceovers/${id}.mp3`,
      };
      await writeFile(
        path.join(dir, `${id}.json`),
        JSON.stringify(item, null, 2),
        { mode: 0o600 },
      );
      if (root === ROOT) await writeStore("voiceover-latest", item);
      return item;
    } finally {
      working = false;
    }
  }
  return { state, configure, generate };
}
export function registerVoiceoverRoutes(app) {
  const service = createVoiceoverService();
  // Serve generated audio only. Credential files and metadata never share this route.
  app.get("/media/voiceovers/:id.mp3", (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    res.sendFile(path.join(outputDir, `${id}.mp3`), { dotfiles: "allow" });
  });
  app.get("/api/voiceover", async (_req, res) =>
    res.json({
      ...(await service.state()),
      latest: await readStore("voiceover-latest", null),
    }),
  );
  app.post("/api/voiceover/config", async (req, res) =>
    res.json(await service.configure(req.body)),
  );
  app.post("/api/voiceover/generate", async (req, res) =>
    res.status(201).json(await service.generate(req.body)),
  );
  app.post("/api/voiceover/:id/apply", async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { runId, version, originalVolume } = z
      .object({
        runId: z.string().uuid(),
        version: z.number().int().positive(),
        originalVolume: z.number().min(0).max(0.5).default(0.12),
      })
      .parse(req.body);
    const narration = JSON.parse(
      await readFile(path.join(outputDir, `${id}.json`), "utf8"),
    );
    const run = findRun(runId),
      cut = run?.versions.find((v) => v.id === version);
    if (!cut) throw new Error("Choose a rendered reel first.");
    const info = await probe(cut.file);
    if (narration.duration > info.duration + 0.2)
      throw new Error(
        `Narration is ${narration.duration.toFixed(1)}s but this reel is ${info.duration.toFixed(1)}s. Shorten the script or make a longer reel; audio will not be cut off.`,
      );
    const folder = path.join(EXPORTS, runId, `voiceover-${randomUUID()}`);
    await mkdir(folder, { recursive: true });
    const file = path.join(folder, "cutroom-narrated.mp4");
    const mix = info.hasAudio
      ? `[0:a]volume=${originalVolume}[bed];[1:a]apad[voice];[bed][voice]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.95[a]`
      : "[1:a]apad,alimiter=limit=0.95[a]";
    await ffmpeg(
      [
        "-i",
        cut.file,
        "-i",
        path.join(outputDir, `${id}.mp3`),
        "-filter_complex",
        mix,
        "-map",
        "0:v:0",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        String(info.duration),
        "-movflags",
        "+faststart",
        file,
      ],
      { timeout: 120000 },
    );
    res
      .status(201)
      .json({
        url: mediaUrl(file),
        duration: info.duration,
        provider: narration.provider,
        message: "New narrated copy created. Your original reel is unchanged.",
      });
  });
  return service;
}
