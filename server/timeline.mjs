import { z } from "zod";
import { gradeSchema } from "./color.mjs";

export const timelineSchema = z.object({
  title: z.string().min(1).max(100),
  rationale: z.string().max(2000).default(""),
  clips: z
    .array(
      z.object({
        assetId: z.string().min(1).max(80),
        start: z.number().finite().min(0),
        end: z.number().finite().positive(),
        framing: z.enum(["crop", "fit"]).default("crop"),
        focalX: z.number().min(0).max(1).default(0.5),
        focalY: z.number().min(0).max(1).default(0.5),
        role: z.string().max(100).default("Story"),
        reason: z.string().max(500).default(""),
        grade: gradeSchema,
      }),
    )
    .min(1)
    .max(12),
});

export function validateTimeline(input, assets, targetDuration) {
  const plan = timelineSchema.parse(input);
  const byId = new Map(assets.map((a) => [a.id, a]));
  for (const clip of plan.clips) {
    const asset = byId.get(clip.assetId);
    if (!asset) throw new Error(`Unknown source asset: ${clip.assetId}`);
    if (clip.end > asset.duration + 0.04)
      throw new Error(
        `Cut exceeds ${asset.name}'s ${asset.duration.toFixed(2)}s duration.`,
      );
    if (clip.end - clip.start < 0.5 || clip.end - clip.start > 12)
      throw new Error("Each shot must be between 0.5 and 12 seconds.");
  }
  const duration = plan.clips.reduce(
    (sum, clip) => sum + clip.end - clip.start,
    0,
  );
  if (duration > 60) throw new Error("Exports are limited to 60 seconds.");
  if (targetDuration && Math.abs(duration - targetDuration) > 0.5)
    throw new Error(
      `Timeline is ${duration.toFixed(2)}s; requested ${targetDuration}s. Adjust the cuts within 0.5s.`,
    );
  return { ...plan, duration: Math.round(duration * 1000) / 1000 };
}

export function visibleSourceBounds(asset, clip) {
  if (clip.framing === "fit") return { left: 0, right: 1, top: 0, bottom: 1 };
  const sourceRatio = asset.width / asset.height;
  const targetRatio = 9 / 16;
  const width = Math.min(1, targetRatio / sourceRatio);
  const height = Math.min(1, sourceRatio / targetRatio);
  const left = Math.max(0, Math.min(1 - width, clip.focalX - width / 2));
  const top = Math.max(0, Math.min(1 - height, clip.focalY - height / 2));
  return { left, right: left + width, top, bottom: top + height };
}

export function parseJson(text) {
  const trimmed = String(text)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{"),
      end = trimmed.lastIndexOf("}");
    if (start < 0 || end < start)
      throw new Error("Model did not return a JSON object.");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
