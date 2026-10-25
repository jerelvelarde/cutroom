export const TIME_ZONE = "America/Los_Angeles";
export const localDate = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
export function eligibleAssets(
  assets,
  { storyMode = "discover", startDate, endDate },
) {
  const personal = assets.filter((a) => a.kind !== "fixture");
  if (storyMode === "discover") return personal;
  if (!startDate || !endDate || startDate > endDate)
    throw new Error("Choose a valid date range for this story.");
  return personal.filter(
    (a) =>
      a.captureDate && a.captureDate >= startDate && a.captureDate <= endDate,
  );
}
export function storyContext({ storyMode, startDate, endDate }) {
  if (storyMode === "today")
    return `Tell the story of my day on ${startDate}. Use only the eligible assets from that date. Infer the narrative from what is actually shown.`;
  if (storyMode === "week")
    return `Tell the story of my SF tech week from ${startDate} through ${endDate}. Find themes and memorable moments. Do not invent event attendance, identities, or locations. Use date metadata for chronology; otherwise use thematic ordering.`;
  return "Discover one compelling story supported by the footage. No written creative brief was supplied.";
}
