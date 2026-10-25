import { z } from "zod";
export const COLOR_VERSION = "rec709-v1";
export const gradeSchema = z
  .object({
    brightness: z.number().min(-0.08).max(0.08).default(0),
    contrast: z.number().min(0.85).max(1.2).default(1),
    saturation: z.number().min(0.65).max(1.25).default(1),
    warmth: z.number().min(-0.15).max(0.15).default(0),
  })
  .default({ brightness: 0, contrast: 1, saturation: 1, warmth: 0 });
export const isHDR = (color) =>
  ["arib-std-b67", "smpte2084"].includes(color?.transfer);
export function normalizeFilter(color) {
  if (isHDR(color))
    return "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:param=0.3:desat=2,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
  if (color?.primaries === "bt2020")
    return "zscale=p=bt709:t=bt709:m=bt709:r=tv,format=yuv420p";
  return "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p";
}
export function gradeFilter(input) {
  const g = gradeSchema.parse(input);
  return `eq=brightness=${g.brightness}:contrast=${g.contrast}:saturation=${g.saturation},colorbalance=rm=${g.warmth * 0.2}:bm=${-g.warmth * 0.2}`;
}
export const COLOR_ARGS = [
  "-color_primaries",
  "bt709",
  "-color_trc",
  "bt709",
  "-colorspace",
  "bt709",
  "-color_range",
  "tv",
];
