import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  realpath,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  scanFolder,
  browseFolders,
  assertSourceAvailable,
  saveExport,
} from "../server/local-files.mjs";

const temp = await realpath(await mkdtemp(path.join(tmpdir(), "cutroom-ssd-")));
process.env.CUTROOM_DATA_DIR = path.join(temp, "cache");
const { indexFolder } = await import("../server/source-folder.mjs");
const { publicAsset } = await import("../server/store.mjs");
after(() => rm(temp, { recursive: true, force: true }));

test("folder scan includes nested media, skips hidden files and symlinks, and rejects oversized libraries", async () => {
  const root = path.join(temp, "scan");
  await mkdir(path.join(root, "day"), { recursive: true });
  await writeFile(path.join(root, "day", "photo.jpg"), "fixture");
  await writeFile(path.join(root, ".hidden.jpg"), "hidden");
  await writeFile(path.join(root, "notes.txt"), "notes");
  await symlink(path.join(root, "day"), path.join(root, "linked-folder"));
  await symlink(
    path.join(root, "day", "photo.jpg"),
    path.join(root, "linked.jpg"),
  );
  const scan = await scanFolder(root);
  assert.deepEqual(
    scan.files.map((f) => f.relativePath),
    ["day/photo.jpg"],
  );
  assert.deepEqual(
    (await browseFolders(root)).folders.map((f) => f.name),
    ["day"],
  );
  await assert.rejects(scanFolder(root, 0), /at most 0/);
  await assert.rejects(scanFolder("relative/path"), /absolute/);
});

test("SSD photo indexing keeps originals untouched, reuses previews, and invalidates modified or disconnected sources", async () => {
  const root = path.join(temp, "footage");
  await mkdir(root);
  const photo = path.join(root, "moment.jpg");
  await sharp({
    create: { width: 80, height: 100, channels: 3, background: "#326ba8" },
  })
    .jpeg()
    .toFile(photo);
  const original = await readFile(photo);
  const first = await indexFolder(root, []);
  const asset = first.assets[0];
  assert.equal(asset.kind, "linked");
  assert.equal(asset.originalFile, photo);
  assert.deepEqual(
    await readFile(photo),
    original,
    "Original bytes must never be modified.",
  );
  assert.ok(asset.file.startsWith(process.env.CUTROOM_DATA_DIR));
  const second = await indexFolder(root, first.assets);
  assert.equal(
    second.assets[0].id,
    asset.id,
    "Unchanged source reuses existing analysis and previews.",
  );
  assert.equal(JSON.stringify(publicAsset(asset)).includes(root), false);
  await writeFile(photo, Buffer.concat([original, Buffer.from("changed")]));
  await assert.rejects(assertSourceAvailable(asset), /changed/);
  const third = await indexFolder(root, second.assets);
  assert.notEqual(third.assets[0].id, asset.id);
  await rm(photo);
  await assert.rejects(assertSourceAvailable(third.assets[0]), /Reconnect/);
});

test("saving a reel makes separate copies without changing source or existing destination files", async () => {
  const root = path.join(temp, "exports");
  await mkdir(root);
  const source = path.join(temp, "render.mp4");
  await writeFile(source, "rendered reel");
  const original = path.join(root, "original.mp4");
  await writeFile(original, "original footage");
  const one = await saveExport(source, root),
    two = await saveExport(source, root);
  assert.notEqual(one.path, two.path);
  assert.equal(await readFile(one.path, "utf8"), "rendered reel");
  assert.equal(await readFile(source, "utf8"), "rendered reel");
  assert.equal(await readFile(original, "utf8"), "original footage");
});
