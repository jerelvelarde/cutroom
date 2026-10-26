import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCaptions } from "../server/agent.mjs";
import { chatEndpoint, currentEdit, creationRequest } from "../server/chat.mjs";

test("minimal polish accepts no captions while rejecting mismatched captioned timelines", () => {
  assert.deepEqual(normalizeCaptions([], 3, "minimal"), ["", "", ""]);
  assert.deepEqual(normalizeCaptions(["a", "b"], 2, "editorial"), ["a", "b"]);
  assert.throws(() => normalizeCaptions(["a"], 3, "minimal"), /one caption/);
});

function harness(decision, overrides = {}) {
  const stores = {
    assets: [{ id: "shot-a", kind: "linked" }],
    "chat-receipts": [],
    storyboard: null,
  };
  const launched = [],
    revised = [];
  const endpoint = chatEndpoint(() => "test-key", {
    decide: async () => decision,
    readStore: async (name, fallback = []) => stores[name] ?? fallback,
    writeStore: async (name, value) => {
      stores[name] = value;
    },
    findRun: () => null,
    launch: async (args) => {
      launched.push(args);
      return { id: "new-render", status: "queued" };
    },
    reviseRun: async (args) => {
      revised.push(args);
      return { id: "revision", status: "queued" };
    },
    ...overrides,
  });
  async function request(state = {}, id = "request-1") {
    const events = [];
    const res = {
      destroyed: false,
      set() {},
      flushHeaders() {},
      write(chunk) {
        if (chunk.startsWith("data: ")) events.push(JSON.parse(chunk.slice(6)));
      },
      end() {},
    };
    await endpoint(
      {
        body: {
          threadId: "test",
          runId: id,
          state,
          messages: [
            { id, role: "user", content: "Make a new 15-second video" },
          ],
        },
      },
      res,
    );
    return events;
  }
  return { request, stores, launched, revised };
}
const create = {
  action: "create",
  reply: "I will create a fresh video.",
  feedback: "A truthful short",
  targetDuration: 15,
};
test("chat creates the first reel, streams a real tool receipt, and replay does not enqueue twice", async () => {
  const h = harness(create);
  const events = await h.request({
    runId: null,
    assetIds: ["shot-a"],
    storyMode: "discover",
  });
  assert.equal(events[0].type, "RUN_STARTED");
  assert.equal(events.at(-1).type, "RUN_FINISHED");
  assert.equal(
    events.find((e) => e.type === "TOOL_CALL_START").toolCallName,
    "create_reel",
  );
  assert.equal(
    JSON.parse(events.find((e) => e.type === "TOOL_CALL_RESULT").content).runId,
    "new-render",
  );
  assert.deepEqual(h.launched[0].assetIds, ["shot-a"]);
  assert.equal(h.launched[0].targetDuration, 15);
  const replay = await h.request();
  assert.equal(h.launched.length, 1);
  assert.equal(
    replay.find((e) => e.type === "TOOL_CALL_START").toolCallName,
    "create_reel",
  );
});
test("new-video workspace never falls back to a previous reel; explicit create never revises", async () => {
  let lookups = 0;
  assert.deepEqual(
    currentEdit({ runId: null }, () => {
      lookups++;
    }),
    { parent: null, version: undefined },
  );
  assert.equal(lookups, 0);
  const parent = { id: "old", versions: [{ id: 2, plan: { title: "Old" } }] };
  const h = harness(create, { findRun: () => parent });
  await h.request({ runId: "old" });
  assert.equal(h.launched.length, 1);
  assert.equal(h.revised.length, 0);
  const first = harness({ ...create, action: "edit" });
  await first.request({ runId: null });
  assert.equal(first.launched.length, 1);
});
test("creation respects selection, date filters, duration, and explicit saved-story sources", () => {
  const state = {
    assetIds: ["a"],
    targetDuration: 45,
    storyMode: "today",
    startDate: "2026-10-25",
    endDate: "2026-10-25",
  };
  const selected = creationRequest(
    { feedback: "Tell the day" },
    state,
    "",
    null,
  );
  assert.deepEqual(selected.assetIds, ["a"]);
  assert.equal(selected.targetDuration, 45);
  assert.equal(selected.storyMode, "today");
  assert.equal(
    creationRequest({ sourceScope: "library" }, state, "all shots", null)
      .assetIds,
    undefined,
  );
  assert.throws(
    () => creationRequest({ useStoryboard: true }, state, "", null),
    /Plan a story first/,
  );
  const plan = {
    mainStory: "A day",
    hook: "Start",
    beats: [
      { assetId: "b", role: "hook", label: "Arrival" },
      { assetId: "b", role: "end", label: "Return" },
    ],
  };
  assert.deepEqual(
    creationRequest({ useStoryboard: true }, state, "Render the plan", plan)
      .assetIds,
    ["b"],
  );
});
test("export returns a download only for the selected completed render and preserves review warnings", async () => {
  const parent = {
    id: "selected",
    status: "needs_review",
    versions: [
      {
        id: 1,
        url: "/media/exports/selected/v1/cutroom-reel.mp4",
        plan: { title: "New video" },
        review: { passed: false },
      },
    ],
  };
  const h = harness(
    { action: "export", reply: "I will get the MP4." },
    { findRun: () => parent },
  );
  const events = await h.request({ runId: "selected" });
  const result = JSON.parse(
    events.find((e) => e.type === "TOOL_CALL_RESULT").content,
  );
  assert.equal(result.reviewPassed, false);
  assert.equal(result.url, parent.versions[0].url);
  assert.equal(h.launched.length, 0);
  parent.status = "rendering";
  const blocked = await h.request({ runId: "selected" }, "request-2");
  assert.equal(blocked.at(-1).type, "RUN_ERROR");
  assert.match(blocked.at(-1).message, /still running/);
});
test("tool failures are visible, redact credentials, and never claim a finished video", async () => {
  const h = harness(create, {
    launch: async () => {
      throw new Error("Source disconnected test-key");
    },
  });
  const events = await h.request();
  const failure = events.find((e) => e.type === "TOOL_CALL_RESULT");
  assert.match(JSON.parse(failure.content).error, /Source disconnected/);
  assert.equal(JSON.stringify(events).includes("test-key"), false);
  assert.equal(events.at(-1).type, "RUN_ERROR");
  assert.equal(h.stores["chat-receipts"].length, 0);
});
test("stop affects only the selected edit, and workspace controls return explicit commands", async () => {
  const stopped = [];
  const h = harness(
    { action: "stop", reply: "Stopping this edit." },
    {
      findRun: (id) => ({ id, status: "rendering", versions: [] }),
      cancelRun: (id) => {
        stopped.push(id);
        return true;
      },
    },
  );
  await h.request({ runId: "chosen" });
  assert.deepEqual(stopped, ["chosen"]);
  const ui = harness({
    action: "workspace",
    reply: "Hiding the library.",
    command: "hide_library",
  });
  const events = await ui.request();
  assert.deepEqual(
    JSON.parse(events.find((e) => e.type === "TOOL_CALL_RESULT").content),
    { command: "hide_library" },
  );
});
