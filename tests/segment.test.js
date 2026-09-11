"use strict";

const assert = require("node:assert/strict");
const { segmentText, protectedRanges, rangeOverlapsProtected } = require("../src/core/segment");

const source = [
  "Fix teh grammar",
  "```js\nconst value = 'teh';\n```",
  "then use `teh`",
  "visit https://example.com/teh",
  "replace {{teh}} and $name",
  "keep \"teh\" exactly"
].join("\n");
const segments = segmentText(source);
assert.equal(segments.map((segment) => segment.text).join(""), source);
assert.ok(segments.some((segment) => segment.kind === "code-fence"));
assert.ok(segments.some((segment) => segment.kind === "inline-code"));
assert.ok(segments.some((segment) => segment.kind === "url"));
assert.ok(segments.some((segment) => segment.kind === "placeholder"));
assert.ok(segments.some((segment) => segment.kind === "quote"));
assert.ok(segments.some((segment) => segment.type === "prose" && segment.text.includes("Fix teh")));

const ranges = protectedRanges(source);
const urlStart = source.indexOf("https://example.com/teh");
assert.equal(rangeOverlapsProtected(ranges, urlStart, urlStart + 5), true);
const proseStart = source.indexOf("Fix teh");
assert.equal(rangeOverlapsProtected(ranges, proseStart, proseStart + 3), false);

const unclosed = segmentText("before ```do not fix teh");
assert.equal(unclosed[1].type, "protected");
assert.equal(unclosed[1].text, "```do not fix teh");

console.log("segment.test.js: all assertions passed");
