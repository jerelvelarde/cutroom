# Hackathon access and resources

Checked October 25, 2026 against the organizer emails and Google builder guide. The local project is configured through its ignored `.env` file. Minimal requests through `server/gemini.mjs` successfully returned `OK` from both `gemini-4-argon` and `antigravity-preview-09-2026` on October 25. Other companion models and credit balances have not been verified.

## Get the event API key

1. Use the account-access instructions supplied directly to you by the hackathon organizers. Keep all passwords and verification codes private.
2. Open [Google AI Studio](https://aistudio.google.com). Choose the profile menu → **Switch account** → **Use another account**, then sign in with the provisioned account from that email. Your personal Google account can remain signed in.
3. Open **Get API key**. Use the provisioned account's event project; confirm the project and available credit allocation before using a personal billing account.
4. Set `GEMINI_API_KEY` in a local `.env` using `.env.example` as the template. Keep `GEMINI_MODEL=gemini-4-argon` and `GEMINI_AGENT=antigravity-preview-09-2026`. The repository ignores `.env` files. The Google account password is not an API key.
5. Run a small request to verify access before starting a large job. If provisioning fails, ask Ivan at the Google booth. Confirm usage restrictions, credit allocation, and expiry with the organizers; no shared credentials are included here.

## Official resources

| Resource | Link |
| --- | --- |
| Builder guide, model IDs, Interactions API examples | [Google hackathon builder guide](https://docs.google.com/document/d/1kN0n6hPNNTIHMVqf5-hDACrZuIg4KFrWiYpla4WQW8w/edit) |
| Event rules, tracks, schedule | [Participant guide](https://cerebralvalley.ai/e/gemini-4-argon-sf/details) |
| Announcements and community | [Hackathon Discord](https://discord.gg/Qr5KBzGm) |
| Project submission | [Submit project](https://cerebralvalley.ai/e/gemini-4-argon-sf/hackathon/submit) |
| Argon development | [Developer guide](https://aistudio.google.com/learn/gemini-4-argon-developer-guide) |
| Coding-agent skills | [Official Gemini skills](https://github.com/google-gemini/gemini-skills) |
| API reference and examples | [Documentation](https://ai.google.dev/gemini-api/docs) · [Cookbook](https://github.com/google-gemini/cookbook) |
| Live voice/video starters | [Live API examples](https://github.com/google-gemini/gemini-live-api-examples) |
| Managed development environment | [Antigravity](https://antigravity.google) |

The builder guide recommends `google-genai` or `@google/genai` version 2.3.0 or later for SDK integrations. This project's current server calls the REST Interactions API directly.

## Models for assets and companion tasks

These IDs are listed in the builder guide. Argon and the managed agent have passed minimal access checks; companion-model availability and quotas still need verification with the provisioned account.

| Purpose | Model / agent ID |
| --- | --- |
| Main reasoning, coding, video understanding | `gemini-4-argon` |
| Managed execution sandbox | `antigravity-preview-09-2026` |
| Fast tasks | `gemini-3.8-flash` |
| Images, textures, sprites | `gemini-nano-banana-2.1` |
| Generated video with audio | `gemini-omni-1.1-flash` |
| Voice and camera interaction | `gemini-3.8-live` |
| Speech generation | `gemini-3.8-flash-tts` |
| Music | `lyria-3.5` |

These are generation tools, not downloaded media packs. No separate downloadable asset pack was identified in the reviewed emails or builder guide.
