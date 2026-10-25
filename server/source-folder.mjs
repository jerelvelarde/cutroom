import { randomUUID } from 'node:crypto';
import { ingestAsset } from './media.mjs';
import { scanFolder, assertSourceAvailable } from './local-files.mjs';

export async function indexFolder(input, existing) {
  const scan = await scanFolder(input);
  if (!scan.files.length) throw new Error('No supported photos or videos were found in this folder.');
  const added = [], errors = [];
  for (const source of scan.files) {
    try {
      const cached = existing.find(a => a.kind === 'linked' && (a.originalFile || a.file) === source.file && a.sourceFingerprint === source.fingerprint);
      const asset = cached || await ingestAsset({ id: randomUUID(), file: source.file, name: source.name, kind: 'linked' });
      Object.assign(asset, { sourceFingerprint: source.fingerprint, sourceFolder: scan.root, relativePath: source.relativePath });
      await assertSourceAvailable(asset);
      added.push(asset);
    } catch (error) { errors.push({ name: source.relativePath, error: error.message }); }
  }
  if (!added.length) throw new Error(errors.map(e => `${e.name}: ${e.error}`).join('\n'));
  return { assets: [...existing.filter(a => a.kind === 'fixture'), ...added], folder: { path: scan.root, count: added.length, scannedAt: new Date().toISOString() }, errors };
}
