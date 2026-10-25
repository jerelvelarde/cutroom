# ElevenLabs voiceover

Open **Voiceover** in Cutroom and save an ElevenLabs API key. The key is stored only on this Mac in ignored `.cutroom/elevenlabs-private.json` with owner-only permissions. The official `npx -y @elevenlabs/cli@latest onboard init` flow stores a key in ignored `.env.local`; the server loads that file automatically. Alternatively set `ELEVENLABS_API_KEY` in the ignored `.env` before starting the server. No credential is returned to the frontend after saving.

Write a script, choose the speaking speed, and select **Generate voiceover**. Cutroom sends only that script to ElevenLabs, using the documented stock George voice and `eleven_v4`. No voice cloning is enabled. Generation consumes the connected account's credits. The public [ElevenLabs API documentation](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) describes account access and available formats.

Play or download the resulting MP3. **Add to current reel** creates a separate MP4 with the original audio lowered under narration. It preserves the video stream and previous exports. The narration must fit the reel; a longer narration is rejected instead of silently cutting off the voice. A 60-second demo script should be used with a 60-second composition, not a 30-second sample reel.

The demo script starts with the founder's supplied words: “Today I joined the Gemini Argon hackathon … I ended up building a tool called Cutroom.” It is an AI-generated narrator reading the founder's script, not a clone of the founder's voice.

An ElevenLabs API key is required for actual ElevenLabs generation. Local macOS synthetic narration, if used as a time-sensitive fallback, is explicitly labeled as such and must not be represented as ElevenLabs output.
