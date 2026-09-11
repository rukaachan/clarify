"use strict";

const assert = require("node:assert/strict");
const settings = require("../src/core/settings");

// The on-page button is opt-in and hidden by default.
assert.equal(settings.DEFAULTS.showButton, false);
assert.equal(settings.normalize({}).showButton, false);
assert.equal(settings.normalize({ showButton: true }).showButton, true);
assert.equal(settings.normalize({ showButton: "yes" }).showButton, false);

// Renamed storage keys.
assert.equal(settings.STORAGE_KEY, "clarifySettings");
assert.equal(settings.API_KEY_STORAGE_KEY, "clarifyGeminiApiKey");

console.log("settings.test.js: all assertions passed");
