import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";

process.env.CUTROOM_DATA_DIR ||= path.resolve(".cutroom/verification");
const { initStore, writeStore } = await import("../server/store.mjs");
const { createFixtures } = await import("../server/fixtures.mjs");
const { loadRuns, startRun, findRun } = await import("../server/agent.mjs");
await initStore();
await loadRuns();
console.log("Generating original synthetic footage for the integration test.");
const assets = await createFixtures();
await writeStore("assets", assets);
const started = startRun(
  {
    brief: "",
    targetDuration: 15,
    assetIds: assets.map((a) => a.id),
    mode: "practice",
  },
  assets,
  "",
);
let count = 0;
const deadline = Date.now() + 10 * 60 * 1000;
while (Date.now() < deadline) {
  const run = findRun(started.id);
  for (const event of run.events.slice(count))
    console.log(`${event.type}: ${event.title}`);
  count = run.events.length;
  if (["failed", "cancelled", "ready", "needs_review"].includes(run.status)) {
    assert.equal(run.status, "ready", run.error || run.summary);
    assert.equal(run.versions.length, 3);
    assert.equal(
      run.versions[0].review.passed,
      false,
      "The known crop defect must fail.",
    );
    assert.equal(
      run.versions[1].review.passed,
      true,
      "Reframing must fix the crop defect.",
    );
    assert.equal(
      run.versions[2].polished,
      true,
      "The final output must use Remotion.",
    );
    assert.equal(
      run.versions[2].review.passed,
      true,
      "The polished output must pass fresh checks.",
    );
    assert.equal(run.versions[2].review.technical.info.width, 720);
    assert.equal(run.versions[2].review.technical.info.height, 1280);
    console.log(
      `PASS: real render → detected defect → repaired render → Remotion polish → final review.\nFinal artifact: ${run.versions[2].file}`,
    );
    process.exit(0);
  }
  await delay(500);
}
throw new Error("Media verification exceeded its time budget.");
