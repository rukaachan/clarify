(function (root) {
  "use strict";

  var MAX_INPUT_LENGTH = 30000;

  function sendMessage(message) {
    return new Promise(function (resolve, reject) {
      if (!root.chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error("Gemini messaging is unavailable"));
        return;
      }
      try {
        chrome.runtime.sendMessage(message, function (response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function countOccurrences(text, fragment) {
    var count = 0;
    var cursor = 0;
    while (fragment && cursor <= text.length) {
      var index = text.indexOf(fragment, cursor);
      if (index < 0) {
        break;
      }
      count += 1;
      cursor = index + fragment.length;
    }
    return count;
  }

  function preservesProtectedFragments(original, corrected) {
    var segmentApi = root.Clarify || {};
    if (typeof segmentApi.protectedRanges !== "function") {
      return true;
    }
    var required = {};
    segmentApi.protectedRanges(original).forEach(function (range) {
      var fragment = original.slice(range.start, range.end);
      required[fragment] = (required[fragment] || 0) + 1;
    });
    return Object.keys(required).every(function (fragment) {
      return countOccurrences(corrected, fragment) >= required[fragment];
    });
  }

  function validateCorrection(original, corrected) {
    if (typeof corrected !== "string" || !corrected.trim() || corrected === original) {
      return { valid: false, error: "empty-or-unchanged" };
    }
    var maximumLength = Math.max(original.length * 3 + 4000, original.length + 500);
    if (corrected.length > maximumLength || corrected.length > MAX_INPUT_LENGTH) {
      return { valid: false, error: "length-limit" };
    }
    if (!preservesProtectedFragments(original, corrected)) {
      return { valid: false, error: "protected-content-changed" };
    }
    return { valid: true };
  }

  function classifyMessagingError(error) {
    var message = String(error && error.message || "");
    if (/receiving end does not exist|could not establish connection|message port closed|messaging is unavailable/i.test(message)) {
      return "service-worker-unavailable";
    }
    return "request-failed";
  }

  function correctWithGemini(text, options) {
    var source = String(text == null ? "" : text);
    var settings = options || {};
    if (!source || source.length > MAX_INPUT_LENGTH) {
      return Promise.resolve({
        text: source,
        changes: [],
        skipped: true,
        error: source.length > MAX_INPUT_LENGTH ? "too-long" : "empty"
      });
    }
    var timeoutMs = Math.min(10000, Math.max(1000, Number(settings.gemini && settings.gemini.timeoutMs) || 5000));
    var timeoutId;
    var timeout = new Promise(function (resolve) {
      timeoutId = window.setTimeout(function () {
        resolve({ text: source, changes: [], error: "timeout" });
      }, timeoutMs + 250);
    });
    var request = sendMessage({
      type: "geminiCorrect",
      text: source,
      timeoutMs: timeoutMs
    }).then(function (response) {
      if (!response || response.ok !== true) {
        return { text: source, changes: [], error: response && response.error || "request-failed" };
      }
      var validation = validateCorrection(source, response.corrected);
      if (!validation.valid) {
        return { text: source, changes: [], error: validation.error };
      }
      return {
        text: response.corrected,
        changes: [{ index: 0, from: source, to: response.corrected, rule: "gemini" }]
      };
    }).catch(function (error) {
      return { text: source, changes: [], error: classifyMessagingError(error) };
    }).finally(function () {
      window.clearTimeout(timeoutId);
    });

    return Promise.race([request, timeout]);
  }

  var api = {
    MAX_INPUT_LENGTH: MAX_INPUT_LENGTH,
    preservesProtectedFragments: preservesProtectedFragments,
    validateCorrection: validateCorrection,
    classifyMessagingError: classifyMessagingError,
    correctWithGemini: correctWithGemini
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Clarify = Object.assign(root.Clarify || {}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
