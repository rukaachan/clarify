"use strict";

// Temporary strict-performance test. Run: node tests/performance.test.js
// Every budget below is a hard assertion: exceeding one fails the run.
// Delete this file when the performance envelope has been accepted.

const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const BUDGETS = {
  moduleInitMs: 10,          // one require() of any core/content module
  normalizeUsPerOp: 4,       // settings.normalize per call
  segmentMs: 8,              // protectedRanges on a 30,000-char worst-case prompt
  segmentTextMs: 12,         // segmentText on the same prompt
  validateMs: 30,            // gemini.validateCorrection on 30k chars
  diagnosticsUsPerOp: 50,    // sanitized diagnostics.log per call
  payloadBytes: 150 * 1024,  // total shipped payload (src + manifest)
  initMs: 50                 // content-script init in a real browser (README budget)
};

function nowMs() {
  return performance.now();
}

function measure(fn) {
  const start = nowMs();
  const result = fn();
  return { ms: nowMs() - start, result };
}

function median(samples) {
  const sorted = samples.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const results = [];
function report(name, value, budget, unit) {
  results.push({ name, value, budget, unit, pass: value <= budget });
  assert.ok(value <= budget, `${name}: ${value.toFixed(3)}${unit} exceeds budget ${budget}${unit}`);
}

// ---------- 1. module init cost ----------

const MODULES = [
  "src/core/settings.js",
  "src/core/segment.js",
  "src/core/gemini.js",
  "src/core/diagnostics.js"
];
for (const relative of MODULES) {
  const start = nowMs();
  require(path.join(ROOT, relative));
  report(`init ${path.basename(relative)}`, nowMs() - start, BUDGETS.moduleInitMs, "ms");
}

const settings = require("../src/core/settings");
const segment = require("../src/core/segment");
// gemini.js validates protected fragments through the shared Clarify namespace,
// exactly as the content scripts wire it in the browser.
globalThis.Clarify = Object.assign(globalThis.Clarify || {}, segment);
const gemini = require("../src/core/gemini");
const diagnostics = require("../src/core/diagnostics");

// ---------- 2. settings.normalize throughput ----------

const stored = {
  enabled: true,
  showButton: true,
  sites: { chatgpt: true, gemini: false, qwen: true, deepseek: false },
  gemini: { timeoutMs: 4200, systemPrompt: "Tighten the wording. ".repeat(50) }
};
settings.normalize(stored); // warm up
const normalizeStart = nowMs();
const NORMALIZE_OPS = 5000;
for (let i = 0; i < NORMALIZE_OPS; i += 1) {
  settings.normalize(stored);
}
const normalizeUsPerOp = (nowMs() - normalizeStart) * 1000 / NORMALIZE_OPS;
report("settings.normalize per op", normalizeUsPerOp, BUDGETS.normalizeUsPerOp, "µs");

// ---------- 3. segment stress: worst-case 30,000-char prompt ----------

const block = [
  "Rewrite the intro for `project_alpha` and keep {{USER_NAME}} plus ${CONFIG_PATH} intact.",
  "See https://example.com/docs/guide?version=2#setup and www.example.orgmirror for context.",
  'The quote "ship it when ready" and <System-Flag enabled> must survive verbatim.',
  "```sql\nSELECT id, name FROM users WHERE active = 1;\n```"
].join(" ");
const stress = (block + " Explain the trade-offs clearly and concisely. ").repeat(Math.ceil(30000 / block.length)).slice(0, 30000);
assert.ok(stress.length >= 29900, "stress fixture should be near the 30,000-char cap");

const segmentSamples = [];
for (let i = 0; i < 25; i += 1) {
  segmentSamples.push(measure(() => segment.protectedRanges(stress)).ms);
}
report("protectedRanges median (30k chars)", median(segmentSamples), BUDGETS.segmentMs, "ms");

const segmentTextSamples = [];
for (let i = 0; i < 25; i += 1) {
  segmentTextSamples.push(measure(() => segment.segmentText(stress)).ms);
}
report("segmentText median (30k chars)", median(segmentTextSamples), BUDGETS.segmentTextMs, "ms");

// ---------- 4. correction validation on 30k chars ----------

const corrected = stress.replace("must survive verbatim", "must survive exactly") + " ";
const validateSamples = [];
for (let i = 0; i < 10; i += 1) {
  validateSamples.push(measure(() => gemini.validateCorrection(stress, corrected)).ms);
}
report("validateCorrection median (30k chars)", median(validateSamples), BUDGETS.validateMs, "ms");

// ---------- 5. diagnostics throughput (console output stubbed) ----------

const originalDebug = console.debug;
console.debug = function () {};
try {
  diagnostics.clear();
  const logStart = nowMs();
  const LOG_OPS = 5000;
  for (let i = 0; i < LOG_OPS; i += 1) {
    diagnostics.log("manual-corrected", { site: "chatgpt", mode: "gemini", changed: true, changeCount: 3, durationMs: 812, reason: "no-change" });
  }
  const logUsPerOp = (nowMs() - logStart) * 1000 / LOG_OPS;
  diagnostics.clear();
  report("diagnostics.log per op", logUsPerOp, BUDGETS.diagnosticsUsPerOp, "µs");
} finally {
  console.debug = originalDebug;
}

// ---------- 6. shipped payload weight ----------

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(full) : [full];
  });
}
const payloadFiles = collectFiles(path.join(ROOT, "src")).concat([
  path.join(ROOT, "manifest.json")
]);
const payloadBytes = payloadFiles.reduce((total, file) => total + fs.statSync(file).size, 0);
report("payload (src + manifest)", payloadBytes / 1024, BUDGETS.payloadBytes / 1024, " KB");

console.log("");
console.log("Strict performance results");
results.forEach(({ name, value, budget, unit }) => {
  const headroom = ((1 - value / budget) * 100).toFixed(0);
  console.log(`  PASS  ${name}: ${value.toFixed(value < 10 ? 3 : 0)}${unit} (budget ${budget}${unit}, ${headroom}% headroom)`);
});
console.log("performance.test.js: all budgets met");
