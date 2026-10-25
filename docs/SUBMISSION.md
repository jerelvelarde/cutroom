# Cutroom — hackathon submission

**Project name:** Cutroom

**Tagline:** Your footage. Your story. An Argon-powered creative workspace.

**GitHub repository:** https://github.com/jerelvelarde/cutroom

**One-minute demo:** https://github.com/user-attachments/assets/c69b345d-0ecd-458b-87f6-cbf929c4a58a

**Demo page and download:** https://github.com/jerelvelarde/cutroom/releases/tag/v0.1.0-hackathon

## Short description

Cutroom turns a day of scattered photos and videos into a coherent story and an editable reel. Gemini Argon analyzes visual previews, finds the strongest moments, proposes a hook and shot sequence, and generates a visual storyboard. Through a managed-agent tool loop, Argon directs local editing tools, reviews the rendered result, and requests repairs to framing, pacing, and color. Creators refine the edit through CopilotKit chat with visible tool activity, then export a new video while keeping their originals untouched. The demo includes ElevenLabs narration. Argon runs through Google's API; media processing and rendering run locally on the Mac.

## How we use Argon

- **Understand:** Analyze compact photo/video previews and capture metadata to identify useful moments and supported story angles.
- **Plan:** Propose a main story, hook, caption, and ordered shots; generate an isolated HTML/CSS visualization that explains the plan.
- **Edit:** Use Antigravity managed-agent orchestration to call constrained local render, review, repair, and polish tools.
- **Review and refine:** Inspect rendered previews for framing, continuity, exposure, white balance, and saturation; combine this assessment with deterministic media checks and incorporate the creator's feedback.

## Demo details

60 seconds, 1920×1080. Actual product captures, creator-approved hackathon footage, and ElevenLabs stock-voice narration. The video is an edited walkthrough; it does not imply all processing completes in one minute.

Google Photos Picker integration is implemented but still requires OAuth client setup for live account import.
