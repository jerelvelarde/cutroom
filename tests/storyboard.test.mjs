import test from "node:test";
import assert from "node:assert/strict";
import { sandboxDocument } from "../server/storyboard.mjs";
test("generated storyboards retain native disclosures while removing executable and external content", async () => {
  const html = await sandboxDocument(
    '<script>parent.fetch("https://bad.example")</script><iframe src="https://bad.example"></iframe><a href="https://bad.example">link</a><img src="https://bad.example/x" onerror="alert(1)"><details open><summary>Why this shot?</summary>Evidence</details><style>.card{color:green}</style>',
    [],
  );
  assert.doesNotMatch(html, /<script|<iframe|onerror=|href=/i);
  assert.match(html, /script-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(
    html,
    /<details open><summary>Why this shot\?<\/summary>Evidence<\/details>/,
  );
  assert.match(html, /<style>\.card/);
  await assert.rejects(
    sandboxDocument('<img src="asset://missing">', []),
    /unknown asset/,
  );
});
