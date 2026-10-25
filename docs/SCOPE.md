# Cutroom — hackathon scope

This document records the original demo scope. The implementation now also includes conversational revisions, basic timeline controls, color handling, and a day planner; see the README for current capabilities and verification limits.

**Product:** a proactive video editor that turns a personal camera roll into a finished reel.

**Primary user:** Jerel, using his own photos and videos.

**Core promise:** choose a story window; Gemini understands the assets, selects the moments, edits and polishes a reel, watches the result, and fixes major problems. No per-asset selection or written creative brief is required.

## P0: the demo we must finish

**Story: Today.** Import up to **50 photos and videos** from today's camera roll and produce one **30-second vertical reel**.

| Step | Required behavior | Visible evidence |
| --- | --- | --- |
| Import | Accept a local batch of photos/videos exported from Google Photos or transferred from a phone. Keep media out of GitHub. | Gallery with previews and capture dates/unknown-date labels |
| Understand | Gemini 4 Argon analyzes compact previews and video proxies. | Factual moment descriptions and useful video timestamps |
| Select | Pick roughly 6–12 strong moments that form a hook, progression, and ending. Reduce redundant or weak choices. | Selected assets and concise reasons; omitted assets remain in the gallery |
| Edit | Google Managed Agents orchestrates real timeline, rendering, and review tools. | Tool events and an inspectable timeline linked to sources |
| Polish | Render a 9:16 MP4 with Remotion titles, restrained photo motion, transitions, and a consistent finish. | A playable, downloadable reel |
| Review | Inspect the rendered result with Gemini and deterministic media checks. Repair major issues within a bounded loop. | Actual findings, revisions when needed, and final review results |
| Approve | Jerel reviews the final video and decides whether to use it. | Preview and download; no automatic publishing |

**Date rule:** Today uses capture dates in America/Los_Angeles. Unknown dates must be surfaced. Jerel may assign a date to a batch; import time must not silently become capture time.

**Output:** 720 × 1280 H.264 MP4, 30 seconds (±0.5s), with original audio when available. Silent photos can remain silent. A 15-second variant supports a fast live demonstration.

## P1: stretch after Today works

**Story: My SF tech week.** Use up to **100 photos and videos** from a date range Jerel chooses and produce one **45-second retrospective**.

The same pipeline must find themes across days, select meaningful moments, and make a coherent story. It must not invent event attendance, identities, relationships, or locations. This adds a larger library and cross-day narrative; it does not add a different editor or integration.

**Stop rule:** do not spend time on P1 until the complete P0 path works with real assets and the provisioned Gemini account.

## Technology commitments

| Technology | Responsibility |
| --- | --- |
| **Gemini 4 Argon (`gemini-4-argon`)** | Understand photos/video; discover and select a narrative; critique the rendered output |
| **Google Antigravity Managed Agents (`antigravity-preview-09-2026`) through Interactions API** | Drive the actual edit → render → review → repair → polish workflow using constrained tools |
| **Remotion** | Final motion design and reel rendering |
| **FFmpeg / ffprobe** | Decode, normalize, trim, frame, assemble, and measure media |
| **Local React/Node app** | Import/gallery, story choice, process trace, preview, and download |

Gemini and Managed Agents are our event-focused technology commitments. Remotion and FFmpeg are supporting implementation choices, not organizer-mandated technologies. The managed agent runs at Google; custom media tools execute locally. The demo must describe that boundary honestly.

## Hard exclusions

- Google Photos OAuth/sync, cloud-drive scanning, phone background monitoring.
- A full editing suite, complex timeline controls, manual keyframes, or an extensive dashboard.
- Generated footage, synthetic voice, music generation, speech transcription, or beat-sync features.
- Automatic social posting, scheduling, collaboration, multi-user accounts, or SaaS deployment.
- Public storage of personal media or inclusion of it in the GitHub repository.
- Additional UI styling work before the core pipeline is verified.

## Privacy

Private Gemini analysis is explicitly allowed. Originals, proxies, thumbnails, asset indexes, analysis, run history, renders, and credentials stay out of GitHub. Public demo videos/screenshots containing personal media require Jerel's approval of the particular artifact.

## Done means

1. Today works end to end on a real personal-media batch, without manual shot selection.
2. Both Gemini 4 Argon and the managed-agent runtime have actually been exercised.
3. The final polished reel exists, plays, and has been reviewed—not just its timeline or rough cut.
4. Selection reasons, real tool execution, and verification are visible in a three-minute demo.
5. Any repair shown actually happened; deliberately flawed synthetic fixtures are labeled as tests.
6. Public code/docs contain no personal assets or keys.
7. An approved one-minute submission video is ready.

Cold analysis need not finish inside the judging slot. Cache source analysis transparently and perform a genuine bounded edit or revision live. Measure cold and warm latency separately. No hard-coded success traces or fabricated quality scores.

## Track fit to confirm

We propose **More Dimensions**, using its render–observe–critique–fix pattern. Its examples emphasize 3D/games, so ask an onsite mentor whether this video-editing application qualifies. The reviewed event guide does not publish a separate scoring rubric for the Managed Agents prize.

[Architecture decision](ADR-001-local-media-managed-editor.md) · [Detailed acceptance checks](ACCEPTANCE.md) · [Official hackathon research](HACKATHON.md)
