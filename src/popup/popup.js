(function () {
  "use strict";

  var settingsApi = globalThis.Clarify.settings;
  var enabled = document.getElementById("enabled");
  var showButton = document.getElementById("show-button");
  var geminiStatus = document.getElementById("gemini-status");
  var buttonStatus = document.getElementById("button-status");
  var connectionStatus = document.getElementById("connection-text");
  var connectionDot = document.getElementById("connection-dot");
  var openOptions = document.getElementById("open-options");

  settingsApi.load().then(function (settings) {
    return settingsApi.getApiKey().then(function (key) {
      enabled.checked = settings.enabled;
      showButton.checked = settings.showButton;
      buttonStatus.textContent = settings.showButton
        ? "Visible beside the composer"
        : "Hidden by default";
      geminiStatus.textContent = key ? "Gemini clarification enabled" : "Gemini API key required";
      connectionStatus.textContent = key
        ? "Model is detected automatically from your key."
        : "Add a Gemini API key in settings.";
      connectionDot.className = "status-dot " + (key ? "is-ok" : "is-warn");
    });
  });

  enabled.addEventListener("change", function () {
    var settings = settingsApi.getCached();
    settings.enabled = enabled.checked;
    settingsApi.save(settings);
  });

  showButton.addEventListener("change", function () {
    var settings = settingsApi.getCached();
    settings.showButton = showButton.checked;
    buttonStatus.textContent = settings.showButton
      ? "Visible beside the composer"
      : "Hidden by default";
    settingsApi.save(settings);
  });

  openOptions.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
})();
