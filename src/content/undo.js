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
      "border:1px solid #bfe0d2",
      "border-radius:999px",
      "background:#eaf8f1",
      "color:#0e7c66",
      "font:700 11px/1.2 'Geist Mono','SF Mono','JetBrains Mono',monospace",
      "letter-spacing:.01em",
      "cursor:pointer",
      "user-select:none"
    ].join(";");
    chip.addEventListener("mouseenter", function () {
      chip.style.background = chip.dataset.state === "pending" ? "#f7ecc8" : "#d8ece1";
    });
    chip.addEventListener("mouseleave", function () {
      chip.style.background = chip.dataset.state === "pending" ? "#fff7d6" : "#eaf8f1";
    });
    document.documentElement.appendChild(chip);
    currentChip = chip;
    return chip;
  }

  function showPending() {
    var chip = createChip("Clarifying…", "Clarifying prompt");
    chip.dataset.state = "pending";
    chip.style.borderColor = "#ead9a0";
    chip.style.background = "#fff7d6";
    chip.style.color = "#6b4e00";
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
      chip.style.borderColor = "#f0c2be";
      chip.style.background = "#fff0ec";
      chip.style.color = "#c83e36";
    } else if (tone === "info") {
      chip.style.borderColor = "#bcd7f6";
      chip.style.background = "#e8f1fc";
      chip.style.color = "#0060c9";
    }
    removeTimer = window.setTimeout(remove, 5000);
    return chip;
  }

  function showUndo(composer, original) {
    var chip = createChip("Clarify Success · Undo", "Undo the Clarify rewrite");
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
