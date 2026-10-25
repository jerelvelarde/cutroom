import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTimeline, visibleSourceBounds, parseJson } from '../server/timeline.mjs';
import { eligibleAssets, localDate } from '../server/stories.mjs';
import { pendingCalls, outputText } from '../server/gemini.mjs';
import { publicAsset } from '../server/store.mjs';

const assets = [{ id: 'a', name: 'source', duration: 10, width: 1280, height: 720 }];
const plan = () => ({ title: 'A story', clips: [{ assetId: 'a', start: 1, end: 6, framing: 'crop', focalX: 0.5, focalY: 0.5 }] });
test('render boundary rejects nonexistent sources, invalid numbers and out-of-bounds cuts', () => {
  assert.equal(validateTimeline(plan(), assets, 5).duration, 5);
  for (const changes of [{ assetId: '../private' }, { end: 11 }, { start: -1 }, { end: NaN }, { focalX: 2 }, { start: 6, end: 5 }]) {
    const input = plan(); Object.assign(input.clips[0], changes);
    assert.throws(() => validateTimeline(input, assets, 5));
  }
  assert.throws(() => validateTimeline(plan(), assets, 30), /requested 30/);
});
test('crop repair keeps the actual off-center fixture subject in view', () => {
  const clip = plan().clips[0];
  const before = visibleSourceBounds(assets[0], clip);
  assert.ok(0.22 < before.left);
  const after = visibleSourceBounds(assets[0], { ...clip, focalX: 0.22 });
  assert.ok(0.22 >= after.left && 0.22 <= after.right);
  assert.deepEqual(visibleSourceBounds(assets[0], { ...clip, framing: 'fit' }), { left: 0, right: 1, top: 0, bottom: 1 });
});
test('date-scoped stories never substitute upload date for missing capture date', () => {
  const library = [
    { id: 'today', kind: 'upload', captureDate: '2026-10-25' },
    { id: 'yesterday', kind: 'upload', captureDate: '2026-10-24' },
    { id: 'unknown', kind: 'upload', captureDate: null, createdAt: '2026-10-25T12:00:00Z' },
    { id: 'fixture', kind: 'fixture', captureDate: '2026-10-25' },
  ];
  assert.deepEqual(eligibleAssets(library, { storyMode: 'today', startDate: '2026-10-25', endDate: '2026-10-25' }).map(a => a.id), ['today']);
  assert.deepEqual(eligibleAssets(library, { storyMode: 'week', startDate: '2026-10-19', endDate: '2026-10-25' }).map(a => a.id), ['today', 'yesterday']);
  assert.equal(eligibleAssets(library, { storyMode: 'discover' }).length, 3);
  assert.throws(() => eligibleAssets(library, { storyMode: 'week', startDate: '2026-10-25', endDate: '2026-10-19' }));
  assert.equal(localDate('2026-10-25T03:00:00Z'), '2026-10-24');
});
test('100-item library eligibility retains every matching asset', () => {
  const library = Array.from({ length: 100 }, (_, id) => ({ id: String(id), kind: 'upload', captureDate: '2026-10-25' }));
  assert.equal(eligibleAssets(library, { storyMode: 'today', startDate: '2026-10-25', endDate: '2026-10-25' }).length, 100);
});
test('agent continuation only executes pending calls once', () => {
  const render = { type: 'function_call', id: 'render-1', name: 'render_edit', arguments: {} };
  const review = { type: 'function_call', id: 'review-1', name: 'review_edit', arguments: {} };
  const interaction = { steps: [render, { type: 'function_result', call_id: 'render-1' }, review], outputs: [review] };
  assert.deepEqual(pendingCalls(interaction).map(c => c.id), ['review-1']);
});
test('model JSON extraction accepts fenced output without hiding invalid content', () => {
  assert.deepEqual(parseJson('```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => parseJson('No structured response'));
  assert.equal(outputText({ output_text: 'OK', outputs: [{ type: 'text', text: 'not duplicated' }] }), 'OK');
});
test('gallery response does not expose original local paths', () => {
  const asset = publicAsset({ id: 'a', file: '/tmp/normalized.jpg', originalFile: '/private/original.heic', proxy: '/tmp/proxy.jpg', thumbnail: '/tmp/thumb.jpg' });
  assert.equal(asset.originalFile, undefined);
  assert.equal(asset.file, undefined);
  assert.equal(JSON.stringify(asset).includes('/private/original'), false);
});
