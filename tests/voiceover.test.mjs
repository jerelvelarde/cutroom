import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createVoiceoverService,
  voiceInput,
  providerError,
  DEFAULT_VOICE,
} from "../server/voiceover.mjs";

test("voiceover validates scripts and speed, keeps credentials private, and does not expose provider errors", async () => {
  assert.throws(() => voiceInput.parse({ text: "" }));
  assert.throws(() => voiceInput.parse({ text: "Hello", speed: 3 }));
  assert.throws(() => voiceInput.parse({ text: "x".repeat(3001) }));
  const root = await mkdtemp(path.join(os.tmpdir(), "cutroom-voice-"));
  let request;
  try {
    const secret = "test-only-key-not-a-real-credential";
    const service = createVoiceoverService({
      root,
      env: {},
      clientFactory: (apiKey) => ({
        textToSpeech: {
          convert: async (voiceId, options) => {
            request = { apiKey, voiceId, options };
            throw Object.assign(new Error(secret), { statusCode: 401 });
          },
        },
      }),
    });
    assert.equal((await service.state()).configured, false);
    assert.equal(
      (await service.configure({ apiKey: secret })).configured,
      true,
    );
    assert.equal(JSON.stringify(await service.state()).includes(secret), false);
    const filename = path.join(root, "elevenlabs-private.json");
    assert.equal((await stat(filename)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(filename, "utf8")).apiKey, secret);
    await assert.rejects(
      service.generate({ text: "An actual demo narration." }),
      (e) => e.message === providerError(401) && !e.message.includes(secret),
    );
    assert.equal(request.apiKey, secret);
    assert.equal(request.voiceId, DEFAULT_VOICE);
    assert.equal(request.options.modelId, "eleven_v4");
    assert.equal((await service.state()).busy, false);
    await assert.rejects(
      service.generate({ text: "Hello", voiceId: "anotherVoice12345" }),
      /stock George/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
