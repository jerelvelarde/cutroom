# Cutroom on your Mac

Run `npm install`, then `npm run dev` and open http://127.0.0.1:4317. Node.js 22.12+, ffprobe, and Google Chrome (for Remotion) are required. FFmpeg is bundled as a project dependency; FFMPEG_PATH can override it. The provisioned Argon credentials live in the ignored `.env`; never copy them into frontend code.

1. **Choose folder.** Browse Home or External drives, or paste an absolute Finder path. Any mounted local folder works; no SSD name is hardcoded. Includes subfolders, skips hidden files and symlinks, and supports up to 100 photos/clips. Individual videos must be 0.5–120 seconds. A render supports at most 10 minutes of source video.
2. **Make reel.** Select Find the story, Today, or My SF tech week, choose a length, and optionally add direction. Argon chooses moments automatically unless you select specific assets. Date filters use capture metadata; click an item to correct a missing date.
3. **Review.** Watch the real MP4, compare versions through the version selector, and expand Edit activity to inspect actions and checks. Make reel starts a new edit; previous reels remain available.
4. **Save reel.** Choose any writable folder, including another SSD folder. Each export has a unique filename and never overwrites existing media.

Originals remain on their drive and are never edited in place. Videos render directly from the source path. Photos use a normalized local copy; previews, timelines, analysis, and renders are stored in ignored `.cutroom/`. Keep the drive attached while editing. Rescan to pick up additions and changes; unchanged assets reuse their previews and analysis. Switching folders replaces the active library but keeps prior reels and cached artifacts. This version has manual rescanning, not a live filesystem watcher. There is no cache cleanup UI yet.

The interface and media processing run locally on your Mac in a browser. Gemini 4 Argon and Antigravity Managed Agents run through Google’s API, not as downloadable local models. Compact previews and metadata are sent for the private analysis authorized for this project. Folder browsing, scanning, playback of cached results, and synthetic pipeline tests do not call Google. Internet is required to create an Argon-directed reel.

The Editing copilot is a real CopilotKit chat connected to Argon through a local AG-UI endpoint. Give feedback on the reel or selected shot; revisions queue behind active work, preserve previous versions, and show actual tool calls, results, and concise editing decisions. API keys stay on the server. Chat history stays in this browser.

The studio has a Remotion player, a shot timeline, trim/framing/reorder controls, and bounded color adjustments. Manual changes are drafts until Render changes completes. iPhone HLG/PQ footage is tone mapped to Rec.709 before grading, and exports carry Rec.709 metadata; this is automatic normalization plus conservative shot corrections, not a calibrated professional grading suite.

Plan the day uses analyzed assets to recommend a main story, content angles, a hook, caption, and an ordered sequence. Argon writes the visualization's HTML/CSS; View Argon's code exposes it. Generated code is sanitized and runs in a script-free, network-isolated iframe. Expand the visual explanations, refine the direction, or make a reel from the plan. Suggestions describe editorial fit, not predicted engagement. At least three analyzed assets are needed; run Make reel once after importing a new library.

For diagnostics, expand About and run the local pipeline test. It generates synthetic footage and real renders without AI; it is labeled accordingly. Automated checks: `npm test`, `npm run build`, and `npm run test:media`.
