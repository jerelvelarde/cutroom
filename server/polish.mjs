import path from "node:path";
import { mkdir, access, writeFile, rename } from "node:fs/promises";
import express from "express";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  selectComposition,
  makeCancelSignal,
} from "@remotion/renderer";
import { ROOT, EXPORTS, mediaUrl } from "./store.mjs";
import { COLOR_ARGS } from "./color.mjs";
import { ffmpeg, probe } from "./media.mjs";

let bundlePromise;
async function browserOptions() {
  const candidate =
    process.env.REMOTION_BROWSER_EXECUTABLE ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "");
  if (candidate) {
    await access(candidate);
    return { browserExecutable: candidate, chromeMode: "chrome-for-testing" };
  }
  return {};
}

export async function polishVersion(
  source,
  runId,
  revision,
  design,
  signal,
  onProgress = () => {},
) {
  signal?.throwIfAborted();
  bundlePromise ||= bundle({
    entryPoint: path.resolve("remotion/index.jsx"),
    outDir: path.join(ROOT, "remotion-bundle"),
    onProgress: () => {},
  }).catch((error) => {
    bundlePromise = null;
    throw error;
  });
  const serveUrl = await bundlePromise;
  const media = express();
  media.use(express.static(path.dirname(source.file)));
  const server = await new Promise((resolve, reject) => {
    const s = media.listen(0, "127.0.0.1");
    s.once("error", reject);
    s.once("listening", () => {
      s.removeListener("error", reject);
      resolve(s);
    });
  });
  const { cancelSignal, cancel } = makeCancelSignal();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const dir = path.join(EXPORTS, runId, `v${revision}`);
    await mkdir(dir, { recursive: true });
    const info = await probe(source.file, signal);
    let cursor = 0;
    const chapters = source.plan.clips.map((clip, i) => {
      const result = {
        start: cursor,
        duration: clip.end - clip.start,
        text: design.captions?.[i] || clip.role,
      };
      cursor += result.duration;
      return result;
    });
    const inputProps = {
      videoSrc: `http://127.0.0.1:${server.address().port}/${path.basename(source.file)}`,
      title: design.title || source.plan.title,
      subtitle: design.subtitle || "A story from your camera roll",
      chapters,
      accent: design.accent || "#df7857",
      style: design.style || "editorial",
      durationInFrames: Math.round(info.duration * 24),
    };
    const browser = await browserOptions();
    signal?.throwIfAborted();
    const composition = await selectComposition({
      serveUrl,
      id: "CutroomReel",
      inputProps,
      ...browser,
    });
    const file = path.join(dir, "cutroom-reel.mp4");
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: file,
      ffmpegOverride: ({ args }) => [
        ...args.slice(0, -1),
        ...COLOR_ARGS,
        args.at(-1),
      ],
      inputProps,
      concurrency: 2,
      cancelSignal,
      ...browser,
      logLevel: "error",
      onProgress: ({ progress }) => onProgress(progress),
      timeoutInMilliseconds: 60000,
    });
    const tagged = path.join(dir, "tagged.mp4");
    await ffmpeg(
      [
        "-i",
        file,
        "-map",
        "0",
        "-c",
        "copy",
        "-bsf:v",
        "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0",
        ...COLOR_ARGS,
        "-movflags",
        "+faststart",
        tagged,
      ],
      { signal },
    );
    await rename(tagged, file);
    const thumbnail = path.join(dir, "thumbnail.jpg"),
      proxy = path.join(dir, "review.mp4");
    await ffmpeg(
      [
        "-ss",
        "1.5",
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
    const plan = {
      ...source.plan,
      title: inputProps.title,
      design: { ...design, chapters },
    };
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
      polished: true,
      colorManaged: true,
      sourceVersion: source.id,
      createdAt: new Date().toISOString(),
      review: null,
    };
  } finally {
    signal?.removeEventListener("abort", cancel);
    await new Promise((resolve) => server.close(resolve));
  }
}
