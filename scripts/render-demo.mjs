import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
// Inputs point to local, explicitly cleared assets; the manifest is never published.
const manifest = JSON.parse(
  await fs.readFile(process.argv[2] || ".cutroom/demo/inputs.json", "utf8"),
);
const app = express();
for (const [key, file] of Object.entries(manifest.files))
  app.get(`/asset/${key}`, (_req, res) =>
    res.sendFile(path.resolve(file), { dotfiles: "allow" }),
  );
const server = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const assets = Object.fromEntries(
    Object.keys(manifest.files).map((key) => [key, `${origin}/asset/${key}`]),
  );
  const inputProps = { assets, voiceLabel: manifest.voiceLabel };
  const serveUrl = await bundle({
    entryPoint: path.resolve("demo/Composition.jsx"),
    outDir: path.resolve(".cutroom/demo/bundle"),
  });
  const browserExecutable =
    process.env.REMOTION_BROWSER_EXECUTABLE ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const opts = {
    serveUrl,
    browserExecutable,
    chromeMode: "chrome-for-testing",
    inputProps,
    logLevel: "error",
  };
  const composition = await selectComposition({ ...opts, id: "CutroomDemo" });
  let last = -1;
  await renderMedia({
    ...opts,
    composition,
    codec: "h264",
    crf: 23,
    outputLocation: path.resolve(
      manifest.output || "demo/cutroom-hackathon-demo.mp4",
    ),
    concurrency: 2,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== last) {
        console.log(`Demo render ${pct}%`);
        last = pct;
      }
    },
  });
  console.log("60-second demo rendered.");
} finally {
  server.closeAllConnections();
  server.close();
}
