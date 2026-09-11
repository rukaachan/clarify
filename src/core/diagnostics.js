(function (root) {
  "use strict";

  var entries = [];
  var MAX_ENTRIES = 40;
  var SAFE_KEYS = ["site", "reason", "changed", "changeCount", "durationMs", "mode"];

  function sanitize(details) {
    var safe = {};
    if (!details || typeof details !== "object") {
      return safe;
    }
    SAFE_KEYS.forEach(function (key) {
      if (details[key] === undefined || details[key] === null) {
        return;
      }
      if (typeof details[key] === "string") {
        safe[key] = details[key].slice(0, 64);
      } else if (typeof details[key] === "boolean" || typeof details[key] === "number") {
        safe[key] = details[key];
      }
    });
    return safe;
  }

  function log(event, details) {
    var entry = Object.assign({ event: String(event), at: Date.now() }, sanitize(details));
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries.shift();
    }
    if (root.console && typeof root.console.debug === "function") {
      root.console.debug("[Clarify]", entry);
    }
  }

  var api = {
    log: log,
    snapshot: function () { return entries.slice(); },
    clear: function () { entries.length = 0; }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Clarify = Object.assign(root.Clarify || {}, { diagnostics: api });
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
