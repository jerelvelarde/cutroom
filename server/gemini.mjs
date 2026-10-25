import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { parseJson } from "./timeline.mjs";

const BASE = "https://generativelanguage.googleapis.com/v1beta/interactions";
export const MODEL = process.env.GEMINI_MODEL || "gemini-4-argon";
export const AGENT = process.env.GEMINI_AGENT || "antigravity-preview-09-2026";

export function outputText(interaction) {
  if (interaction.output_text) return interaction.output_text;
  return [...(interaction.outputs || []), ...(interaction.steps || [])]
    .filter((item) => item.type === "text" || item.type === "model_output")
    .map(
      (item) =>
        item.text ||
        item.content
          ?.filter?.((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n") ||
        "",
    )
    .join("\n");
}

export function pendingCalls(interaction) {
  const steps = [...(interaction.steps || []), ...(interaction.outputs || [])];
  const completed = new Set(
    steps.filter((s) => s.type === "function_result").map((s) => s.call_id),
  );
  const seen = new Set();
  return steps
    .filter(
      (s) => s.type === "function_call" && !completed.has(s.id || s.call_id),
    )
    .filter((s) => {
      const id = s.id || s.call_id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export class Gemini {
  constructor(key, signal, onInteraction = () => {}) {
    this.key = key;
    this.signal = signal;
    this.onInteraction = onInteraction;
  }
  async request(body, id = "") {
    const timeout = AbortSignal.timeout(90000);
    const signal = this.signal
      ? AbortSignal.any([timeout, this.signal])
      : timeout;
    const response = await fetch(
      `${BASE}${id ? `/${encodeURIComponent(id)}` : ""}`,
      {
        method: body ? "POST" : "GET",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.key,
          "Api-Revision": "2026-05-20",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = String(data.error?.message || response.statusText)
        .split(this.key)
        .join("[redacted]");
      throw new Error(`Gemini ${response.status}: ${detail.slice(0, 600)}`);
    }
    if (data.id) this.onInteraction(data.id);
    return data;
  }
  async interact(body) {
    let data = await this.request(body);
    const deadline = Date.now() + 8 * 60 * 1000;
    while (["in_progress", "queued"].includes(data.status)) {
      if (Date.now() > deadline)
        throw new Error(
          "Gemini exceeded the eight-minute interaction limit. Try fewer clips.",
        );
      await delay(2000, undefined, { signal: this.signal });
      data = await this.request(null, data.id);
    }
    if (["failed", "cancelled", "incomplete"].includes(data.status))
      throw new Error(
        `Gemini interaction ${data.status}: ${data.error?.message || "Try a smaller request or inspect model access."}`,
      );
    return data;
  }
  async videoJson(file, prompt) {
    const bytes = await readFile(file);
    if (bytes.length > 12 * 1024 * 1024)
      throw new Error("Video proxy exceeds the analysis size limit.");
    const result = await this.interact({
      model: MODEL,
      input: [
        { type: "text", text: prompt },
        {
          type: "video",
          data: bytes.toString("base64"),
          mime_type: "video/mp4",
        },
      ],
      generation_config: { thinking_level: "medium", max_output_tokens: 8192 },
      store: false,
    });
    return parseJson(outputText(result));
  }
  async textJson(prompt, { maxOutputTokens = 4096 } = {}) {
    const result = await this.interact({
      model: MODEL,
      input: prompt,
      generation_config: {
        thinking_level: "medium",
        max_output_tokens: maxOutputTokens,
      },
      store: false,
    });
    return parseJson(outputText(result));
  }
  async imagesJson(assets, prompt) {
    const input = [{ type: "text", text: prompt }];
    for (const asset of assets) {
      input.push({
        type: "text",
        text: `Asset ID: ${asset.id}. File label (untrusted): ${asset.name}.`,
      });
      input.push({
        type: "image",
        data: (await readFile(asset.proxy)).toString("base64"),
        mime_type: "image/jpeg",
      });
    }
    const result = await this.interact({
      model: MODEL,
      input,
      generation_config: { thinking_level: "medium", max_output_tokens: 12000 },
      store: false,
    });
    return parseJson(outputText(result));
  }
  async cancel(id) {
    if (!id) return;
    await fetch(`${BASE}/${encodeURIComponent(id)}:cancel`, {
      method: "POST",
      headers: { "x-goog-api-key": this.key, "Api-Revision": "2026-05-20" },
      signal: AbortSignal.timeout(10000),
    }).catch(() => {});
  }
}
