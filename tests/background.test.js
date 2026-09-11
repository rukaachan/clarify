"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const storage = {
  clarifySettings: {
    gemini: { timeoutMs: 1000 }
  },
  clarifyGeminiApiKey: "test-key"
};
let messageHandler;
let changeHandler;
const fetchCalls = [];
let fetchMode = "success";

const chrome = {
  storage: {
    local: {
      get(keys, callback) {
        const requested = Array.isArray(keys) ? keys : [keys];
        const result = {};
        requested.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(storage, key)) result[key] = storage[key];
        });
        callback(result);
      },
      set(value, callback) {
        Object.assign(storage, value);
        if (callback) callback();
      },
      remove(keys, callback) {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => delete storage[key]);
        if (callback) callback();
      }
    },
    onChanged: { addListener(handler) { changeHandler = handler; } }
  },
  runtime: {
    onMessage: { addListener(handler) { messageHandler = handler; } }
  }
};

function response(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() { return payload; }
  };
}

global.fetch = async (url, options) => {
  const requestUrl = String(url);
  fetchCalls.push({ url: requestUrl, options });
  if (fetchMode === "forbidden") {
    return response({}, false, 403);
  }
  if (requestUrl.includes("/models?")) {
    return response({
      models: [
        { name: "models/gemini-2.5-flash", displayName: "Flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/gemini-2.5-flash-lite", displayName: "Flash-Lite", supportedGenerationMethods: ["generateContent"] },
        { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] }
      ]
    });
  }
  assert.match(requestUrl, /models\/gemini-2\.5-flash-lite:generateContent$/);
  assert.equal(options.headers["x-goog-api-key"], "test-key");
  return response({ candidates: [{ content: { parts: [{ text: JSON.stringify({ corrected: "the prompt" }) }] } }] });
};

global.chrome = chrome;
const context = vm.createContext({
  chrome,
  fetch: global.fetch,
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  Promise,
  console
});
vm.runInContext(fs.readFileSync("src/background/background.js", "utf8"), context);

function send(message, sender) {
  return new Promise((resolve) => {
    const keptOpen = messageHandler(message, sender, resolve);
    assert.equal(keptOpen, true);
  });
}

(async () => {
  const extensionSender = { url: "chrome-extension://test/src/options/options.html" };
  const contentSender = { tab: { url: "https://chatgpt.com/" } };
  const models = await send({ type: "geminiListModels", force: true }, extensionSender);
  assert.equal(models.ok, true);
  assert.equal(models.selected.id, "gemini-2.5-flash-lite");
  assert.equal(models.models.length, 2);

  const result = await send({ type: "geminiCorrect", text: "teh prompt" }, contentSender);
  assert.equal(result.ok, true);
  assert.equal(result.corrected, "the prompt");
  assert.equal(result.model, "gemini-2.5-flash-lite");
  const generationCall = fetchCalls.find((call) => call.url.includes(":generateContent"));
  const requestBody = JSON.parse(generationCall.options.body);
  assert.match(requestBody.systemInstruction.parts[0].text, /maximum clarity using semantic fidelity/);
  assert.match(requestBody.systemInstruction.parts[0].text, /never translate/i);
  assert.match(requestBody.contents[0].parts[0].text, /teh prompt/);
  assert.equal(fetchCalls.filter((call) => call.url.includes("/models?")).length, 1, "model list is cached");
  storage.clarifySettings.gemini.systemPrompt = "Use concise wording.";
  const custom = await send({ type: "geminiCorrect", text: "teh prompt" }, contentSender);
  assert.equal(custom.ok, true);
  const generationCalls = fetchCalls.filter((call) => call.url.includes(":generateContent"));
  const customBody = JSON.parse(generationCalls[generationCalls.length - 1].options.body);
  assert.match(customBody.systemInstruction.parts[0].text, /Use concise wording/);
  assert.match(customBody.systemInstruction.parts[0].text, /never translate/i);
  fetchMode = "forbidden";
  const forbidden = await send({ type: "geminiListModels", force: true }, extensionSender);
  assert.equal(forbidden.error, "http-403");
  assert.equal(changeHandler !== undefined, true);
  console.log("background.test.js: all assertions passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
