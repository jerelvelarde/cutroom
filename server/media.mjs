import ffmpegStatic from "ffmpeg-static";
import {
  COLOR_VERSION,
  COLOR_ARGS,
  normalizeFilter,
  gradeFilter,
  isHDR,
} from "./color.mjs";
import { spawn } from "node:child_process";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import exifr from "exifr";
import { ASSETS, EXPORTS, mediaUrl } from "./store.mjs";
import { validateTimeline } from "./timeline.mjs";
import { localDate } from "./stories.mjs";
import { assertSourceAvailable } from "./local-files.mjs";

export function command(program, args, { signal, timeout = 120000 } = {}) {
  if (program === "ffmpeg")
    program = process.env.FFMPEG_PATH || ffmpegStatic || program;
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      signal,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (data) => {
      stdout = (stdout + data).slice(-2_000_000);
    });
    child.stderr.on("data", (data) => {
      stderr = (stderr + data).slice(-200_000);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `${program} failed (${code ?? "stopped"}): ${stderr.slice(-800)}`,
          ),
        );
    });
  });
}
export async function probe(file, signal) {
  const { stdout } = await command(
    "ffprobe",
    ["-v", "error", "-show_format", "-show_streams", "-of", "json", file],
    { signal, timeout: 20000 },
  );
  const data = JSON.parse(stdout);
  const video = data.streams.find((s) => s.codec_type === "video");
  if (!video || !Number.isFinite(Number(data.format.duration)))
    throw new Error(
      "This file does not contain a playable video with a duration.",
    );
  const rotation = Number(
    video.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ||
      video.tags?.rotate ||
      0,
  );
  const rotated = Math.abs(rotation) % 180 === 90;
  const created = data.format.tags?.creation_time || video.tags?.creation_time;
  return {
    color: {
      transfer: video.color_transfer || "unknown",
      primaries: video.color_primaries || "unknown",
      space: video.color_space || "unknown",
      range: video.color_range || "unknown",
      dolbyVision: Boolean(
        video.side_data_list?.some(
          (s) => s.side_data_type === "DOVI configuration record",
        ),
      ),
    },
    duration: Number(data.format.duration),
    width: rotated ? video.height : video.width,
    height: rotated ? video.width : video.height,
    hasAudio: data.streams.some((s) => s.codec_type === "audio"),
    bytes: Number(data.format.size),
    captureDate:
      created && !Number.isNaN(Date.parse(created)) ? localDate(created) : null,
  };
}
export const ffmpeg = (args, options) =>
  command(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-threads",
      "2",
      "-filter_threads",
      "1",
      ...args,
    ],
    options,
  );

export async function ingestAsset(
  { id, file, name, kind = "upload", attribution = null, fixture = null },
  signal,
) {
  if (/\.(jpe?g|png|webp|heic|heif)$/i.test(file)) {
    const dir = path.join(ASSETS, id);
    await mkdir(dir, { recursive: true });
    const originalFile = file;
    const normalized = path.join(dir, "photo.jpg"),
      thumbnail = path.join(dir, "thumbnail.jpg"),
      proxy = path.join(dir, "analysis.jpg");
    const metadata = await exifr
      .parse(originalFile, ["DateTimeOriginal"])
      .catch(() => null);
    try {
      await sharp(file)
        .rotate()
        .toColourspace("srgb")
        .resize(3840, 3840, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 94 })
        .toFile(normalized);
    } catch (error) {
      if (!/\.hei[cf]$/i.test(file) || process.platform !== "darwin")
        throw error;
      const decoded = path.join(dir, "decoded.jpg");
      await command("sips", ["-s", "format", "jpeg", file, "--out", decoded], {
        signal,
        timeout: 30000,
      });
      await sharp(decoded)
        .rotate()
        .toColourspace("srgb")
        .resize(3840, 3840, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 94 })
        .toFile(normalized);
    }
    await Promise.all([
      sharp(normalized)
        .resize(640, 640, { fit: "inside" })
        .jpeg({ quality: 82 })
        .toFile(thumbnail),
      sharp(normalized)
        .resize(1000, 1000, { fit: "inside" })
        .jpeg({ quality: 80 })
        .toFile(proxy),
    ]);
    const info = await sharp(normalized).metadata();
    const captureDate =
      metadata?.DateTimeOriginal instanceof Date &&
      !Number.isNaN(metadata.DateTimeOriginal.getTime())
        ? localDate(metadata.DateTimeOriginal)
        : null;
    return {
      id,
      name,
      kind,
      mediaType: "photo",
      attribution,
      fixture,
      duration: 10,
      width: info.width,
      height: info.height,
      hasAudio: false,
      bytes: (await stat(originalFile)).size,
      file: normalized,
      originalFile,
      proxy,
      thumbnail,
      captureDate,
      dateSource: captureDate ? "capture metadata" : "unknown",
      createdAt: new Date().toISOString(),
      analysis: null,
    };
  }
  const info = await probe(file, signal);
  if (info.duration < 0.5 || info.duration > 120)
    throw new Error(
      "Choose clips between 0.5 and 120 seconds for this hackathon build.",
    );
  if (info.width > 8192 || info.height > 8192)
    throw new Error("Maximum source dimension is 8192 pixels.");
  const dir = path.join(ASSETS, id);
  await mkdir(dir, { recursive: true });
  const thumbnail = path.join(dir, "thumbnail.jpg");
  const proxy = path.join(dir, "proxy.mp4");
  await ffmpeg(
    [
      "-ss",
      String(Math.min(1, info.duration / 3)),
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      `scale=640:-2,${normalizeFilter(info.color)}`,
      "-q:v",
      "3",
      thumbnail,
    ],
    { signal },
  );
  await ffmpeg(
    [
      "-i",
      file,
      "-vf",
      `scale=480:480:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=12,${normalizeFilter(info.color)}`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "29",
      "-c:a",
      "aac",
      "-b:a",
      "48k",
      ...COLOR_ARGS,
      "-movflags",
      "+faststart",
      proxy,
    ],
    { signal },
  );
  if ((await stat(proxy)).size > 12 * 1024 * 1024)
    throw new Error(
      "The preview is too large for inline analysis. Try a shorter clip.",
    );
  return {
    id,
    name,
    kind,
    mediaType: "video",
    attribution,
    fixture,
    ...info,
    colorVersion: COLOR_VERSION,
    colorTreatment: isHDR(info.color) ? "HDR → Rec.709" : "Rec.709",
    dateSource: info.captureDate ? "capture metadata" : "unknown",
    file,
    proxy,
    thumbnail,
    createdAt: new Date().toISOString(),
    analysis: null,
  };
}

export async function renderTimeline(
  input,
  assets,
  runId,
  revision,
  targetDuration,
  signal,
) {
  const plan = validateTimeline(input, assets, targetDuration);
  const dir = path.join(EXPORTS, runId, `v${revision}`);
  await mkdir(dir, { recursive: true });
  const segments = [];
  for (const [index, clip] of plan.clips.entries()) {
    signal?.throwIfAborted();
    const asset = assets.find((a) => a.id === clip.assetId);
    await assertSourceAvailable(asset);
    const segment = path.join(dir, `segment-${index}.mp4`);
    const duration = clip.end - clip.start;
    const sourceColor =
      asset.mediaType === "photo"
        ? null
        : (await probe(asset.file, signal)).color;
    const vf =
      clip.framing === "fit"
        ? "scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=0x171c1b,setsar=1,fps=24"
        : `scale=720:1280:force_original_aspect_ratio=increase:force_divisible_by=2,crop=720:1280:x='max(0,min(iw-ow,iw*${clip.focalX}-ow/2))':y='max(0,min(ih-oh,ih*${clip.focalY}-oh/2))',setsar=1,fps=24`;
    const args =
      asset.mediaType === "photo"
        ? ["-loop", "1", "-i", asset.file]
        : ["-ss", String(clip.start), "-i", asset.file];
    if (!asset.hasAudio)
      args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
    args.push(
      "-map",
      "0:v:0",
      "-map",
      asset.hasAudio ? "0:a:0" : "1:a:0",
      "-t",
      String(duration),
      "-vf",
      `${vf},${normalizeFilter(sourceColor)},${gradeFilter(clip.grade)}`,
      "-af",
      `aresample=48000,apad,afade=t=in:d=0.06,afade=t=out:st=${Math.max(0, duration - 0.06)}:d=0.06`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ac",
      "2",
      "-ar",
      "48000",
      "-b:a",
      "128k",
      ...COLOR_ARGS,
      "-movflags",
      "+faststart",
      segment,
    );
    await ffmpeg(args, { signal });
    segments.push(segment);
  }
  const list = path.join(dir, "segments.txt");
  await writeFile(
    list,
    segments.map((_, i) => `file 'segment-${i}.mp4'`).join("\n"),
  );
  const file = path.join(dir, "cutroom.mp4");
  await ffmpeg(
    [
      "-f",
      "concat",
      "-safe",
      "1",
      "-i",
      list,
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      file,
    ],
    { signal },
  );
  const thumbnail = path.join(dir, "thumbnail.jpg");
  await ffmpeg(
    [
      "-ss",
      "0.2",
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      "scale=360:-2",
      thumbnail,
    ],
    { signal },
  );
  const proxy = path.join(dir, "review.mp4");
  await ffmpeg(
    [
      "-i",
      file,
      "-vf",
      "scale=270:480,fps=12",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "29",
      "-c:a",
      "aac",
      "-b:a",
      "48k",
      ...COLOR_ARGS,
      "-movflags",
      "+faststart",
      proxy,
    ],
    { signal },
  );
  await writeFile(
    path.join(dir, "timeline.json"),
    JSON.stringify(plan, null, 2),
  );
  return {
    id: revision,
    plan,
    file,
    proxy,
    url: mediaUrl(file),
    thumbnailUrl: mediaUrl(thumbnail),
    timelineUrl: mediaUrl(path.join(dir, "timeline.json")),
    colorManaged: true,
    createdAt: new Date().toISOString(),
    review: null,
  };
}

export async function technicalReview(version, targetDuration, signal) {
  const info = await probe(version.file, signal);
  const { stderr } = await command(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-i",
      version.file,
      "-vf",
      "blackdetect=d=0.15:pix_th=0.1:pic_th=0.98",
      "-an",
      "-f",
      "null",
      "-",
    ],
    { signal },
  );
  const gaps = [
    ...stderr.matchAll(
      /black_start:([\d.]+) black_end:([\d.]+) black_duration:([\d.]+)/g,
    ),
  ].map((m) => ({
    start: Number(m[1]),
    end: Number(m[2]),
    duration: Number(m[3]),
  }));
  const checks = [
    {
      id: "color",
      label: "Standard video color",
      passed:
        info.color.primaries === "bt709" &&
        info.color.transfer === "bt709" &&
        info.color.space === "bt709",
      detail: `${info.color.primaries} · ${info.color.transfer} · ${info.color.space}`,
    },
    {
      id: "dimensions",
      label: "Vertical export",
      passed: info.width === 720 && info.height === 1280,
      detail: `${info.width} × ${info.height}`,
    },
    {
      id: "duration",
      label: "Duration matches brief",
      passed: Math.abs(info.duration - targetDuration) < 0.6,
      detail: `${info.duration.toFixed(2)}s / ${targetDuration}s`,
    },
    {
      id: "sources",
      label: "Source ranges valid",
      passed: true,
      detail: `${version.plan.clips.length} cuts checked before rendering`,
    },
    {
      id: "black",
      label: "No black gaps detected",
      passed: gaps.length === 0,
      detail: gaps.length
        ? `${gaps.length} dark interval(s); inspect these frames`
        : "Full export scanned; 98% black threshold",
    },
    {
      id: "audio",
      label: "Audio track present",
      passed: info.hasAudio,
      detail: "Original audio where available; silence for silent sources",
    },
  ];
  return { info, checks, gaps, passed: checks.every((c) => c.passed) };
}

export async function prepareColorAssets(
  assets,
  signal,
  onProgress = async () => {},
) {
  const prepared = [];
  for (const asset of assets) {
    if (
      asset.mediaType !== "video" ||
      asset.kind === "fixture" ||
      asset.colorVersion === COLOR_VERSION
    ) {
      prepared.push(asset);
      continue;
    }
    await assertSourceAvailable(asset);
    await onProgress(asset);
    const refreshed = await ingestAsset(
      { id: asset.id, file: asset.file, name: asset.name, kind: asset.kind },
      signal,
    );
    prepared.push({
      ...asset,
      ...refreshed,
      captureDate: asset.captureDate,
      dateSource: asset.dateSource,
      analysis: null,
    });
  }
  return prepared;
}
