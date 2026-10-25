import { readdir, realpath, stat, lstat, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const SUPPORTED = /\.(mp4|mov|m4v|webm|jpe?g|png|webp|heic|heif)$/i;
export const fingerprint = (info) =>
  [info.dev, info.ino, info.size, info.mtimeMs].join(":");
export async function directory(input) {
  if (typeof input !== "string" || !path.isAbsolute(input))
    throw new Error("Choose an absolute folder path.");
  const resolved = await realpath(input);
  if (!(await stat(resolved)).isDirectory())
    throw new Error("Choose a folder, not a file.");
  return resolved;
}
export async function browseFolders(input = homedir()) {
  const folder = await directory(input);
  const entries = await readdir(folder, { withFileTypes: true });
  return {
    path: folder,
    parent: path.dirname(folder),
    home: homedir(),
    folders: entries
      .filter(
        (e) =>
          !e.name.startsWith(".") && e.isDirectory() && !e.isSymbolicLink(),
      )
      .map((e) => ({ name: e.name, path: path.join(folder, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
export async function scanFolder(input, limit = 100) {
  const root = await directory(input),
    files = [];
  let visited = 0;
  async function visit(folder) {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (++visited > 10000)
        throw new Error(
          "This folder is too large to scan. Choose a smaller footage folder.",
        );
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && SUPPORTED.test(entry.name)) {
        if (files.length >= limit)
          throw new Error(
            `Choose a folder containing at most ${limit} supported photos and videos, including subfolders.`,
          );
        const info = await stat(file);
        files.push({
          file,
          name: entry.name,
          relativePath: path.relative(root, file),
          fingerprint: fingerprint(info),
        });
      }
    }
  }
  await visit(root);
  return { root, files };
}
export async function assertSourceAvailable(asset) {
  if (asset.kind !== "linked") return;
  try {
    const original = asset.originalFile || asset.file;
    if (
      (await lstat(original)).isSymbolicLink() ||
      (await realpath(original)) !== original ||
      fingerprint(await stat(original)) !== asset.sourceFingerprint
    )
      throw new Error("changed");
  } catch {
    throw new Error(
      `“${asset.name}” is unavailable or changed. Reconnect the drive and rescan its folder before editing.`,
    );
  }
}
export async function saveExport(file, destination) {
  const folder = await directory(destination);
  const name = `Cutroom-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.mp4`;
  const output = path.join(folder, name);
  // Exclusive copy: an export can never overwrite an original or previous cut.
  await copyFile(file, output, constants.COPYFILE_EXCL);
  return { path: output, name };
}
