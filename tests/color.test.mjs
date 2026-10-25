import test from "node:test";
import assert from "node:assert/strict";
import { gradeSchema, normalizeFilter, isHDR } from "../server/color.mjs";
import { validateTimeline } from "../server/timeline.mjs";

test("HDR is tone-mapped, SDR avoids the tone mapper, and color controls are bounded", () => {
  for (const transfer of ["arib-std-b67", "smpte2084"]) {
    assert.equal(isHDR({ transfer }), true);
    assert.match(
      normalizeFilter({ transfer, primaries: "bt2020" }),
      /tonemap=/,
    );
    assert.match(normalizeFilter({ transfer }), /t=bt709/);
  }
  assert.doesNotMatch(
    normalizeFilter({ transfer: "bt709", primaries: "bt709" }),
    /tonemap=/,
  );
  assert.throws(() => gradeSchema.parse({ saturation: 20 }));
  assert.throws(() => gradeSchema.parse({ brightness: NaN }));
  const plan = {
    title: "Revision",
    clips: [
      {
        assetId: "x",
        start: 1,
        end: 6,
        grade: { warmth: 0.05, saturation: 0.9 },
      },
    ],
  };
  const checked = validateTimeline(
    plan,
    [{ id: "x", name: "clip", duration: 10 }],
    5,
  );
  assert.equal(checked.clips[0].grade.saturation, 0.9);
  assert.equal(checked.clips[0].grade.warmth, 0.05);
  assert.equal(checked.clips[0].grade.contrast, 1);
});
