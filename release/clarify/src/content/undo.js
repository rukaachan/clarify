(function (root) {
  "use strict";

  var currentChip = null;
  var removeTimer = null;

  function remove() {
    if (removeTimer) {
      window.clearTimeout(removeTimer);
      removeTimer = null;
    }
    if (currentChip && currentChip.isConnected) {
      currentChip.remove();
    }
    currentChip = null;
  }

  function createChip(label, buttonLabel) {
    remove();
    var chip = document.createElement("button");
    chip.type = "button";
    chip.textContent = label;
    chip.setAttribute("aria-label", buttonLabel || label);
    chip.style.cssText = [
      "all:initial",
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:2147483647",
      "display:block",
      "padding:8px 12px",
      "border:1px solid #c8dfc7",
      "border-radius:999px",
      "background:#edf3ec",
      "color:#346538",
      "font:700 11px/1.2 'Geist Mono','SF Mono','JetBrains Mono',monospace",
      "letter-spacing:.01em",
      "cursor:pointer",
      "user-select:none"
    ].join(";");
    chip.addEventListener("mouseenter", function () {
      chip.style.background = chip.dataset.state === "pending" ? "#f5eac6" : "#e1ede0";
    });
    chip.addEventListener("mouseleave", function () {
      chip.style.background = chip.dataset.state === "pending" ? "#fbf3db" : "#edf3ec";
    });
    document.documentElement.appendChild(chip);
    currentChip = chip;
    return chip;
  }

  function showPending() {
    var chip = createChip("Clarifying…", "Clarifying prompt");
    chip.dataset.state = "pending";
    chip.style.borderColor = "#ebdcae";
    chip.style.background = "#fbf3db";
    chip.style.color = "#956400";
    chip.disabled = true;
    chip.style.cursor = "wait";
    return chip;
  }

  function showNotice(message, tone) {
    var chip = createChip(message, message);
    chip.disabled = true;
    chip.style.cursor = "default";
    chip.dataset.state = tone || "notice";
    if (tone === "error") {
      chip.style.borderColor = "#efc5c5";
      chip.style.background = "#fdebec";
      chip.style.color = "#9f2f2d";
    } else if (tone === "info") {
      chip.style.borderColor = "#b9d6e7";
      chip.style.background = "#e1f3fe";
      chip.style.color = "#1f6c9f";
    }
    removeTimer = window.setTimeout(remove, 5000);
    return chip;
  }

  function showUndo(composer, original) {
    var chip = createChip("Grammar corrected · Undo", "Undo grammar correction");
    chip.addEventListener("click", function () {
      if (composer && composer.isConnected) {
        root.Clarify.composer.setText(composer, original);
        composer.focus();
      }
      remove();
    });
    removeTimer = window.setTimeout(remove, 8000);
    return chip;
  }

  var api = {
    remove: remove,
    showPending: showPending,
    showNotice: showNotice,
    showUndo: showUndo
  };

  root.Clarify = Object.assign(root.Clarify || {}, { undo: api });
})(typeof globalThis !== "undefined" ? globalThis : window);
