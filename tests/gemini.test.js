"use strict";

const assert = require("node:assert/strict");
global.Clarify = require("../src/core/segment");
global.window = global;
global.chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) {
      assert.equal(message.type, "geminiCorrect");
      assert.equal(message.text, "teh prompt");
      callback({ ok: true, corrected: "the prompt" });
    }
  }
};

const {
  validateCorrection,
  preservesProtectedFragments,
  classifyMessagingError,
  correctWithGemini
} = require("../src/core/gemini");

assert.deepEqual(validateCorrection("teh prompt", "the prompt"), { valid: true });
assert.equal(validateCorrection("same", "same").valid, false);
assert.equal(validateCorrection("`teh`", "`the`").error, "protected-content-changed");
assert.equal(preservesProtectedFragments("`teh` https://example.com/teh", "`teh` https://example.com/teh"), true);
assert.equal(preservesProtectedFragments("`teh`", "`the`"), false);
assert.equal(classifyMessagingError(new Error("Could not establish connection. Receiving end does not exist.")), "service-worker-unavailable");
assert.equal(classifyMessagingError(new Error("network down")), "request-failed");

(async function () {
  const result = await correctWithGemini("teh prompt", {
    gemini: { timeoutMs: 1000 }
  });
  assert.equal(result.text, "the prompt");
  assert.equal(result.changes[0].rule, "gemini");
  console.log("gemini.test.js: all assertions passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
