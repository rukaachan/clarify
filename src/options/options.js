(function () {
  "use strict";

  var settingsApi = globalThis.Clarify.settings;
  var form = document.getElementById("settings-form");
  var enabled = document.getElementById("enabled");
  var showButton = document.getElementById("show-button");
  var timeout = document.getElementById("timeout");
  var timeoutValue = document.getElementById("timeout-value");
  var systemPrompt = document.getElementById("system-prompt");
  var resetSystemPrompt = document.getElementById("reset-system-prompt");
  var apiKey = document.getElementById("api-key");
  var revealKey = document.getElementById("reveal-key");
  var connectionBadge = document.getElementById("connection-badge");
  var detectedModel = document.getElementById("detected-model");
  var saveStatus = document.getElementById("save-status");
  var testButton = document.getElementById("test-connection");

  function setConnection(state, label) {
    connectionBadge.textContent = label;
    connectionBadge.className = "badge " + state;
  }

  function setTimeoutLabel() {
    timeoutValue.textContent = timeout.value + " s";
  }

  function describeConnectionError(code) {
    var messages = {
      "missing-api-key": "This extension copy has no saved Gemini API key.",
      "http-400": "Gemini rejected the request. Check API access and model availability.",
      "http-401": "Gemini rejected the API key.",
      "http-403": "Gemini denied access. Check API restrictions and permissions.",
      "http-404": "The selected Gemini model is unavailable. Detect models again.",
      "models-unavailable": "Gemini model discovery failed.",
      "no-compatible-model": "No compatible Gemini model was found.",
      "rate-limit": "Gemini rate limit reached. Try again later."
    };
    return messages[code] || code || "Gemini could not be reached.";
  }

  function sendMessage(message) {
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage(message, function (response) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  function markCustomPrompt() {
    var isCustom = systemPrompt.value.trim() &&
      systemPrompt.value.trim() !== settingsApi.DEFAULTS.gemini.systemPrompt;
    systemPrompt.classList.toggle("has-custom", Boolean(isCustom));
  }

  function fill(settings, key) {
    enabled.checked = settings.enabled;
    showButton.checked = settings.showButton;
    timeout.value = String(Math.round(settings.gemini.timeoutMs / 1000));
    systemPrompt.value = settings.gemini.systemPrompt;
    apiKey.value = key;
    ["chatgpt", "gemini", "qwen", "deepseek"].forEach(function (site) {
      document.getElementById("site-" + site).checked = settings.sites[site];
    });
    setTimeoutLabel();
    markCustomPrompt();
  }

  function readSettings() {
    var settings = settingsApi.getCached();
    settings.enabled = enabled.checked;
    settings.showButton = showButton.checked;
    settings.gemini.timeoutMs = Number(timeout.value) * 1000;
    settings.gemini.systemPrompt = systemPrompt.value.trim() || settingsApi.DEFAULTS.gemini.systemPrompt;
    ["chatgpt", "gemini", "qwen", "deepseek"].forEach(function (site) {
      settings.sites[site] = document.getElementById("site-" + site).checked;
    });
    return settings;
  }

  function testConnection() {
    var key = apiKey.value.trim();
    if (!key) {
      setConnection("error", "API key required");
      detectedModel.textContent = "Paste a key before detecting models.";
      return;
    }
    testButton.disabled = true;
    setConnection("pending", "Detecting…");
    detectedModel.textContent = "Checking Gemini access and compatible models…";
    settingsApi.saveApiKey(key).then(function () {
      return sendMessage({ type: "geminiListModels", force: true });
    }).then(function (response) {
      if (!response || response.ok !== true || !response.selected) {
        throw new Error(response && response.error || "No compatible model found");
      }
      setConnection("success", "Connected");
      detectedModel.textContent = "Auto-selected " + response.selected.id + " · " + response.models.length + " compatible model" + (response.models.length === 1 ? "" : "s");
    }).catch(function (error) {
      setConnection("error", "Connection failed");
      detectedModel.textContent = describeConnectionError(error.message);
    }).finally(function () {
      testButton.disabled = false;
    });
  }

  timeout.addEventListener("input", setTimeoutLabel);
  systemPrompt.addEventListener("input", markCustomPrompt);
  showButton.addEventListener("change", function () {
    // Persist immediately: the content script reacts to storage changes, so the
    // button appears or disappears on open tabs without an explicit save.
    var settings = settingsApi.getCached();
    settings.showButton = showButton.checked;
    settingsApi.save(settings);
  });
  revealKey.addEventListener("click", function () {
    var revealed = apiKey.type === "password";
    apiKey.type = revealed ? "text" : "password";
    revealKey.textContent = revealed ? "Hide" : "Show";
    revealKey.setAttribute("aria-pressed", String(revealed));
    revealKey.setAttribute("aria-label", revealed ? "Hide API key" : "Show API key");
  });
  resetSystemPrompt.addEventListener("click", function () {
    systemPrompt.value = settingsApi.DEFAULTS.gemini.systemPrompt;
    markCustomPrompt();
    systemPrompt.focus();
  });
  testButton.addEventListener("click", testConnection);
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var next = readSettings();
    Promise.all([settingsApi.save(next), settingsApi.saveApiKey(apiKey.value)]).then(function () {
      saveStatus.textContent = "Saved.";
      window.setTimeout(function () { saveStatus.textContent = ""; }, 2400);
    });
  });

  settingsApi.load().then(function (settings) {
    return settingsApi.getApiKey().then(function (key) {
      fill(settings, key);
      if (key) {
        setConnection("pending", "Ready to detect");
        detectedModel.textContent = "Save or test the connection to refresh model detection.";
      }
    });
  });
})();
