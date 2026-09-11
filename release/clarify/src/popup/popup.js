(function () {
  "use strict";

  var settingsApi = globalThis.Clarify.settings;
  var enabled = document.getElementById("enabled");
  var geminiStatus = document.getElementById("gemini-status");
  var connectionStatus = document.getElementById("connection-status");
  var openOptions = document.getElementById("open-options");

  settingsApi.load().then(function (settings) {
    return settingsApi.getApiKey().then(function (key) {
      enabled.checked = settings.enabled;
      geminiStatus.textContent = key ? "Gemini correction enabled" : "Gemini API key required";
      connectionStatus.textContent = key
        ? "Model is detected automatically from your key."
        : "Add a Gemini API key in settings.";
    });
  });

  enabled.addEventListener("change", function () {
    var settings = settingsApi.getCached();
    settings.enabled = enabled.checked;
    settingsApi.save(settings);
  });

  openOptions.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
})();
