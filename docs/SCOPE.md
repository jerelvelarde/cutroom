# Cutroom — delivered hackathon scope

Cutroom turns a selected day of personal media into a story plan and a reviewed vertical reel. The shipped prototype includes local SSD ingestion, multimodal Argon analysis, managed tool execution, a Remotion player and timeline inspector, CopilotKit revisions, HDR normalization and bounded grading, agent-authored visual storyboards, Google Photos Picker integration, and optional ElevenLabs narration.

The creator explicitly expanded the original P0 on October 25 to include these integrations, editing controls, design polish, and a one-minute narrated product demo. Earlier exclusions for Photos OAuth, voice generation, and timeline controls are superseded by those requests.

## Boundaries

- Originals remain untouched; exports are new files.
- The UI and media processing are local. Google runs the model and managed-agent orchestration.
- Google Photos accesses explicitly selected media after OAuth setup and consent, not the full account automatically.
- The app does not publish to social platforms, schedule posts, or provide multi-user hosting.
- Published screenshots and demo use explicitly approved hackathon footage. Raw originals, previews, cached analysis, credentials, and history stay out of Git.
- Tool receipts describe real execution. The demo includes actual interface recordings and actual reviewed media. Cached analysis is not presented as a new cold run.

## Verification

The core reel was rendered from real imported media and checked for source bounds, dimensions, duration, black gaps, audio, and Rec.709 metadata, followed by Argon visual review. Manual grading choices remain visible; subjective color concerns are reported rather than hidden. Google Photos provider tests use mocks; live Google account import requires user setup.

See [README](../README.md), [local workflow](LOCAL-MAC.md), and [architecture](ADR-001-local-media-managed-editor.md).
