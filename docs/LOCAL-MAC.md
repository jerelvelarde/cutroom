# Cutroom on your Mac

Run `npm ci`, then `npm run dev` and open http://127.0.0.1:4317. Node.js, FFmpeg/ffprobe, and Google Chrome (for Remotion) are required. The provisioned Argon credentials live in the ignored `.env`; never copy them into frontend code.

1. **Choose folder.** Browse Home or External drives, or paste an absolute Finder path. Any mounted local folder works; no SSD name is hardcoded. Includes subfolders, skips hidden files and symlinks, and supports up to 100 photos/clips. Individual videos must be 0.5–120 seconds. A render supports at most 10 minutes of source video.
2. **Make reel.** Select Find the story, Today, or My SF tech week, choose a length, and optionally add direction. Argon chooses moments automatically unless you select specific assets. Date filters use capture metadata; click an item to correct a missing date.
3. **Review.** Watch the real MP4, compare versions through the version selector, and expand Edit activity to inspect actions and checks. Make reel starts a new edit; previous reels remain available.
4. **Save reel.** Choose any writable folder, including another SSD folder. Each export has a unique filename and never overwrites existing media.

Originals remain on their drive and are never edited in place. Videos render directly from the source path. Photos use a normalized local copy; previews, timelines, analysis, and renders are stored in ignored `.cutroom/`. Keep the drive attached while editing. Rescan to pick up additions and changes; unchanged assets reuse their previews and analysis. Switching folders replaces the active library but keeps prior reels and cached artifacts. This version has manual rescanning, not a live filesystem watcher. There is no cache cleanup UI yet.

The interface and media processing run locally on your Mac in a browser. Gemini 4 Argon and Antigravity Managed Agents run through Google’s API, not as downloadable local models. Compact previews and metadata are sent for the private analysis authorized for this project. Folder browsing, scanning, playback of cached results, and synthetic pipeline tests do not call Google. Internet is required to create an Argon-directed reel.

CopilotKit chat is connected to a local AG-UI endpoint. Feedback can queue a revised render, with real tool calls and concise editing summaries. The timeline supports trimming, ordering, crop/fit, and bounded color changes; render the draft to see those changes. HDR footage is normalized to Rec.709 before rendering. These newer paths still need full live acceptance testing.

Use **Plan the day** after at least three moments have been analyzed. Argon recommends an evidence-supported story, content angles, and source order, and writes a sandboxed interactive storyboard. Its code can be inspected in the workspace. Suggestions are editorial, not predicted view counts.

For diagnostics, expand About and run the local pipeline test. It generates synthetic footage and real renders without AI; it is labeled accordingly. Automated checks: `npm test`, `npm run build`, and `npm run test:media`.
