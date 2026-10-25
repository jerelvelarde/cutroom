import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(process.env.CUTROOM_DATA_DIR || ".cutroom");
export const ASSETS = path.join(ROOT, "assets");
export const EXPORTS = path.join(ROOT, "exports");
let queue = Promise.resolve();

export async function initStore() {
  await Promise.all([
    mkdir(ASSETS, { recursive: true }),
    mkdir(EXPORTS, { recursive: true }),
  ]);
}
export async function readStore(name, fallback = []) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, `${name}.json`), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
export function writeStore(name, value) {
  const snapshot = JSON.stringify(value, null, 2);
  queue = queue
    .catch(() => {})
    .then(async () => {
      const filename = path.join(ROOT, `${name}.json`);
      await writeFile(`${filename}.tmp`, snapshot);
      await rename(`${filename}.tmp`, filename);
    });
  return queue;
}
export const mediaUrl = (file) =>
  `/media/${path.relative(ROOT, file).split(path.sep).join("/")}`;
export function publicAsset(asset) {
  const {
    file,
    proxy,
    thumbnail,
    originalFile,
    sourceFolder,
    sourceFingerprint,
    ...rest
  } = asset;
  return {
    ...rest,
    url:
      asset.kind === "linked" && asset.mediaType === "video"
        ? mediaUrl(proxy)
        : mediaUrl(file),
    proxyUrl: `${mediaUrl(proxy)}?color=${asset.colorVersion || "original"}`,
    thumbnailUrl: `${mediaUrl(thumbnail)}?color=${asset.colorVersion || "original"}`,
  };
}
