"use strict";

const assert = require("node:assert/strict");
const diagnostics = require("../src/core/diagnostics");

diagnostics.clear();
diagnostics.log("manual-failed", {
  site: "gemini",
  mode: "gemini",
  reason: "request-failed",
  prompt: "sensitive prompt must not be logged",
  apiKey: "sensitive key must not be logged"
});

const [entry] = diagnostics.snapshot();
assert.equal(entry.event, "manual-failed");
assert.equal(entry.site, "gemini");
assert.equal(entry.mode, "gemini");
assert.equal(entry.reason, "request-failed");
assert.equal(Object.prototype.hasOwnProperty.call(entry, "prompt"), false);
assert.equal(Object.prototype.hasOwnProperty.call(entry, "apiKey"), false);

diagnostics.clear();
console.log("diagnostics.test.js: all assertions passed");
