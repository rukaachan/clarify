(function (root) {
  "use strict";

  var api = root.Clarify;
  var state = {
    siteId: null,
    settings: null,
    currentComposer: null,
    watcher: null,
    ready: false,
    busy: false,
    replaying: false
  };

  function getComposer(target) {
    var current = state.currentComposer;
    if (current && current.isConnected) {
      if (!target || !target.closest || !current.closest("form") ||
          target === current || target.closest("form") === current.closest("form")) {
        return current;
      }
    }
    return api.composer.findComposer(state.siteId, current);
  }

  function makeKeyboardEvent() {
    var event = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      composed: true,
      keyCode: 13,
      which: 13
    });
    try {
      Object.defineProperty(event, "keyCode", { value: 13 });
      Object.defineProperty(event, "which", { value: 13 });
    } catch (error) {
      // KeyboardEvent fields are read-only in some browser versions.
    }
    return event;
  }

  function replaySubmit(context, composer) {
    state.replaying = true;
    try {
      if (context.kind === "click" && context.submitter && context.submitter.isConnected) {
        context.submitter.click();
        return;
      }
      if ((context.kind === "submit" || context.kind === "keydown") && context.form && context.form.isConnected) {
        if (typeof context.form.requestSubmit === "function") {
          context.form.requestSubmit(context.submitter || undefined);
        } else {
          context.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
        return;
      }
      composer.dispatchEvent(makeKeyboardEvent());
    } finally {
      state.replaying = false;
    }
  }

  function diagnostic(event, details) {
    if (api.diagnostics && typeof api.diagnostics.log === "function") {
      api.diagnostics.log(event, Object.assign({ site: state.siteId, mode: "gemini" }, details || {}));
    }
  }

  function getFailureNotice(reason) {
    var notices = {
      "missing-api-key": "Gemini key not found here · Open Settings",
      "http-400": "Gemini request rejected · Check model access",
      "http-401": "Gemini key rejected · Check the API key",
      "http-403": "Gemini access denied · Check API restrictions",
      "http-404": "Gemini model unavailable · Detect models in Settings",
      "models-unavailable": "Gemini model discovery failed · Detect models",
      "no-compatible-model": "No compatible Gemini model · Detect models",
      "rate-limit": "Gemini rate limit reached · Try again later",
      "timeout": "Gemini timed out · Try again",
      "network": "Gemini network error · Check your connection",
      "service-worker-unavailable": "Extension background unavailable · Reload it",
      "invalid-response": "Gemini returned an invalid response · Try again",
      "request-failed": "Gemini request failed · Check Settings"
    };
    return notices[reason] || notices["request-failed"];
  }

  function chooseCorrection(original, settings) {
    api.undo.showPending();
    return api.correctWithGemini(original, settings).then(function (remote) {
      if (!remote.error && !remote.skipped) {
        return {
          result: {
            text: remote.text,
            changes: remote.changes || []
          },
          remoteUsed: true
        };
      }
      return {
        result: { text: original, changes: [] },
        remoteUsed: true,
        remoteFailed: true,
        reason: remote.error || "request-failed"
      };
    });
  }

  function processManualFix(composer) {
    if (!state.ready || state.busy || !composer || !composer.isConnected || !state.settings ||
        !api.settings.isSiteEnabled(state.settings, state.siteId)) {
      return;
    }
    var original = api.composer.getText(composer);
    if (!original.trim()) {
      diagnostic("manual-empty");
      return;
    }

    var startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    var settings = state.settings;
    state.busy = true;
    api.fixButton.setBusy(true);
    diagnostic("manual-start");
    chooseCorrection(original, settings).then(function (decision) {
      var result = decision.result;
      if (api.composer.getText(composer) !== original) {
        api.undo.remove();
        diagnostic("manual-cancelled", { reason: "input-changed" });
        return;
      }
      if (result.text !== original) {
        var set = api.composer.setText(composer, result.text);
        if (set && api.composer.getText(composer) === result.text) {
          api.undo.remove();
          api.undo.showUndo(composer, original);
          diagnostic("manual-corrected", {
            changed: true,
            changeCount: result.changes.length
          });
        } else {
          api.undo.showNotice("Could not update the composer", "error");
          diagnostic("manual-failed", { reason: "composer-update" });
        }
      } else {
        api.undo.remove();
        var message;
        var tone = "info";
        if (decision.reason === "too-long") {
          message = "Prompt is too long for Gemini";
        } else if (decision.remoteFailed && decision.reason !== "empty-or-unchanged") {
          message = getFailureNotice(decision.reason);
          tone = "error";
        } else {
          message = "No changes needed";
        }
        api.undo.showNotice(message, tone);
        diagnostic("manual-no-change", {
          reason: decision.remoteFailed ? decision.reason : "no-change"
        });
      }
    }).catch(function () {
      api.undo.showNotice("Correction failed · Original kept", "error");
      diagnostic("manual-failed", { reason: "exception" });
    }).finally(function () {
      var duration = (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt;
      state.busy = false;
      api.fixButton.setBusy(false);
      api.fixButton.update();
      diagnostic("manual-finish", { durationMs: Math.round(duration) });
    });
  }

  function processSubmission(context, composer, original, settings) {
    return chooseCorrection(original, settings).then(function (decision) {
      var result = decision.result;
      var currentText = api.composer.getText(composer);

      // Never overwrite edits made while Gemini was processing the previous snapshot.
      if (currentText !== original) {
        api.undo.remove();
        replaySubmit(context, composer);
        return;
      }

      if (result.text !== original) {
        var set = api.composer.setText(composer, result.text);
        if (!set || api.composer.getText(composer) !== result.text) {
          api.undo.remove();
          replaySubmit(context, composer);
          return;
        }
        replaySubmit(context, composer);
        api.undo.remove();
        api.undo.showUndo(composer, original);
        return;
      }

      api.undo.remove();
      replaySubmit(context, composer);
    }).catch(function () {
      // Fail open: a grammar failure must never prevent the user's message.
      api.undo.remove();
      if (composer && composer.isConnected) {
        replaySubmit(context, composer);
      }
    }).finally(function () {
      state.busy = false;
      api.fixButton.setBusy(false);
      api.fixButton.update();
    });
  }

  function handleSubmit(kind, event) {
    if (!state.ready || state.replaying || !state.settings ||
        !api.settings.isSiteEnabled(state.settings, state.siteId)) {
      return false;
    }
    if (state.busy) {
      return true;
    }

    var target = event && event.target;
    var composer = getComposer(target);
    if (!composer || (kind === "click" && !api.composer.isSendControl(target))) {
      return false;
    }

    var original = api.composer.getText(composer);
    if (!original.trim()) {
      return false;
    }

    var context = {
      kind: kind,
      submitter: kind === "click" ? (target.closest && target.closest("button, [role='button'], input[type='submit']")) : null,
      form: kind === "submit" && target && target.tagName === "FORM" ? target : composer.closest("form")
    };
    state.busy = true;
    api.fixButton.setBusy(true);
    processSubmission(context, composer, original, state.settings);
    return true;
  }

  function init() {
    state.siteId = api.settings.getSiteId(window.location.hostname);
    if (!state.siteId) {
      state.ready = true;
      return;
    }
    api.settings.load().then(function (settings) {
      state.settings = settings;
      if (api.settings.isSiteEnabled(settings, state.siteId)) {
        state.watcher = api.composer.watchComposer(state.siteId, function (composer) {
          state.currentComposer = composer;
          api.fixButton.attach(composer, processManualFix);
        });
      }
      state.ready = true;
    });

    if (root.chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(function () {
        state.settings = api.settings.getCached();
        if (!api.settings.isSiteEnabled(state.settings, state.siteId) && state.watcher) {
          state.watcher.disconnect();
          state.watcher = null;
          state.currentComposer = null;
          api.fixButton.detach();
        } else if (api.settings.isSiteEnabled(state.settings, state.siteId) && !state.watcher) {
          state.watcher = api.composer.watchComposer(state.siteId, function (composer) {
            state.currentComposer = composer;
            api.fixButton.attach(composer, processManualFix);
          });
        }
      });
    }
  }

  var controller = {
    handleKeydown: function (event) {
      return handleSubmit("keydown", event);
    },
    handleClick: function (event) {
      return handleSubmit("click", event);
    },
    handleFormSubmit: function (event) {
      return handleSubmit("submit", event);
    },
    isReplaying: function () { return state.replaying; },
    getState: function () { return state; }
  };

  api.controller = controller;
  init();
})(typeof globalThis !== "undefined" ? globalThis : window);
