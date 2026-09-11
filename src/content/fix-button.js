(function (root) {
  "use strict";

  var host = null;
  var shadow = null;
  var button = null;
  var label = null;
  var composer = null;
  var anchor = null;
  var inputListener = null;
  var BUTTON_HEIGHT = 34;

  function parseColor(value) {
    var match = String(value || "").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (!match || (match[4] !== undefined && Number(match[4]) === 0)) {
      return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  function isDarkSurface(element) {
    var candidates = [element, element && element.parentElement, document.body, document.documentElement];
    for (var index = 0; index < candidates.length; index += 1) {
      if (!candidates[index]) {
        continue;
      }
      var color = parseColor(window.getComputedStyle(candidates[index]).backgroundColor);
      if (!color) {
        continue;
      }
      var luminance = (color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000;
      return luminance < 128;
    }
    return false;
  }

  function getRect(element) {
    return element && element.getBoundingClientRect ? element.getBoundingClientRect() : null;
  }

  function findAnchor(element) {
    var composerRect = getRect(element);
    if (!composerRect) {
      return element;
    }

    var expanded = null;
    var expandedDelta = Infinity;
    var wideFallback = null;
    var wideFallbackDelta = Infinity;
    var node = element.parentElement;
    for (var depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      var rect = getRect(node);
      if (!rect || rect.width <= composerRect.width || rect.height < composerRect.height) {
        continue;
      }
      var isReasonableWidth = rect.width <= window.innerWidth * 0.95;
      var isReasonableHeight = rect.height <= composerRect.height + 140;
      if (isReasonableWidth && isReasonableHeight) {
        var heightDelta = rect.height - composerRect.height;
        if (heightDelta < wideFallbackDelta) {
          wideFallback = node;
          wideFallbackDelta = heightDelta;
        }
        if (heightDelta >= 8 && heightDelta < expandedDelta) {
          expanded = node;
          expandedDelta = heightDelta;
        }
      }
      if (node.tagName === "FORM") {
        break;
      }
    }
    return expanded || wideFallback || element;
  }

  function setLabel(text) {
    if (label) {
      label.textContent = text;
    }
  }

  function createButton(onClick) {
    if (host) {
      return;
    }
    host = document.createElement("div");
    host.setAttribute("data-clarify-control", "fix-button");
    host.setAttribute("aria-live", "polite");
    host.style.cssText = [
      "position:fixed",
      "z-index:2147483646",
      "width:max-content",
      "height:" + BUTTON_HEIGHT + "px",
      "pointer-events:none",
      "display:none",
      "opacity:0",
      "transform:translateY(-3px)",
      "transition:opacity 180ms cubic-bezier(.16,1,.3,1),transform 180ms cubic-bezier(.16,1,.3,1)"
    ].join(";");
    shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = [
      ":host{all:initial}",
      "button{all:initial;box-sizing:border-box;display:flex;width:auto;min-width:0;height:" + BUTTON_HEIGHT + "px;align-items:center;justify-content:center;gap:6px;padding:0 12px;border:1px solid #111;border-radius:999px;background:#111;color:#fff;font:700 11px/1 'SF Pro Display','Geist Sans','Helvetica Neue',sans-serif;letter-spacing:.005em;white-space:nowrap;cursor:pointer;pointer-events:auto;user-select:none;transition:background 180ms cubic-bezier(.16,1,.3,1),border-color 180ms cubic-bezier(.16,1,.3,1),transform 180ms cubic-bezier(.16,1,.3,1)}",
      "button:hover{background:#0071e3;border-color:#0071e3}",
      "button:active{transform:scale(.97)}",
      "button:focus-visible{outline:2px solid #0071e3;outline-offset:2px}",
      "button[data-theme=dark]{border-color:rgba(255,255,255,.16);background:#2a2a2a;color:#f5f5f5}",
      "button[data-theme=dark]:hover{border-color:#0071e3;background:#0071e3;color:#fff}",
      "button:disabled{cursor:default;opacity:1}",
      "button[data-busy=true]{opacity:.72}",
      "button[data-empty=true]{border-color:#d5d5d1;background:#f7f6f3;color:#787774}",
      "button[data-theme=dark][data-empty=true]{border-color:rgba(255,255,255,.22);background:#2a2a2a;color:#e4e4e4}",
      "svg{display:block;flex:0 0 auto;width:14px;height:14px;overflow:visible}",
      "path{fill:none;stroke:currentColor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.55}"
    ].join("");
    button = document.createElement("button");
    button.type = "button";
    button.innerHTML = "<svg viewBox='0 0 18 18' aria-hidden='true'><path d='M3.2 13.8 6.7 4.2h1.5l3.5 9.6M4.5 10.6h5.9M11.8 11.6l1.5 1.5 2.7-3.3'/></svg><span></span>";
    label = button.querySelector("span");
    setLabel("Clarify");
    button.setAttribute("aria-label", "Clarify prompt");
    button.addEventListener("mousedown", function (event) {
      // Keep the composer focused so a manual click does not move the caret unexpectedly.
      event.preventDefault();
    });
    button.addEventListener("click", function () {
      if (!button.disabled && typeof onClick === "function") {
        onClick(composer);
      }
    });
    shadow.appendChild(style);
    shadow.appendChild(button);
    document.documentElement.appendChild(host);
  }

  function setBusy(isBusy) {
    if (!button) {
      return;
    }
    button.dataset.busy = String(isBusy);
    button.disabled = isBusy;
    setLabel(isBusy ? "Clarifying…" : "Clarify");
    button.setAttribute("aria-label", isBusy ? "Clarifying prompt" : "Clarify prompt");
    update();
  }

  function update() {
    if (!host || !button || !composer || !composer.isConnected) {
      return;
    }
    if (!anchor || !anchor.isConnected) {
      anchor = findAnchor(composer);
    }
    var surface = anchor || composer;
    var rect = getRect(surface);
    var visible = rect && rect.width > 0 && rect.height > 0 && window.getComputedStyle(surface).visibility !== "hidden";
    var text = root.Clarify.composer.getText(composer);
    var empty = !text.trim();
    if (!visible) {
      host.style.display = "none";
      host.style.opacity = "0";
      return;
    }

    button.dataset.theme = isDarkSurface(surface) ? "dark" : "light";
    button.dataset.empty = String(empty);
    button.disabled = empty || button.dataset.busy === "true";
    host.style.display = "block";
    host.style.opacity = "1";
    host.style.transform = "translateY(0)";

    var renderedRect = getRect(host);
    var buttonWidth = renderedRect && renderedRect.width > 0 ? renderedRect.width : 104;
    var buttonHeight = renderedRect && renderedRect.height > 0 ? renderedRect.height : BUTTON_HEIGHT;
    var gap = 8;
    var left;
    var top;
    var canPlaceRight = rect.right + gap + buttonWidth <= window.innerWidth - gap;
    var canPlaceLeft = rect.left - gap - buttonWidth >= gap;

    if (canPlaceRight) {
      left = rect.right + gap;
      top = rect.top + (rect.height - buttonHeight) / 2;
    } else if (canPlaceLeft) {
      left = rect.left - gap - buttonWidth;
      top = rect.top + (rect.height - buttonHeight) / 2;
    } else {
      left = Math.min(window.innerWidth - buttonWidth - gap, Math.max(gap, rect.right - buttonWidth));
      var below = rect.bottom + gap;
      top = below + buttonHeight <= window.innerHeight - gap
        ? below
        : Math.max(gap, rect.top - buttonHeight - gap);
    }
    host.style.left = Math.round(left) + "px";
    host.style.top = Math.round(top) + "px";
  }

  function attach(nextComposer, onClick) {
    if (!nextComposer) {
      detach();
      return;
    }
    if (composer !== nextComposer) {
      detach();
      composer = nextComposer;
      anchor = findAnchor(composer);
      createButton(onClick);
      inputListener = update;
      composer.addEventListener("input", inputListener, { passive: true });
      window.addEventListener("resize", update, { passive: true });
      window.addEventListener("scroll", update, { passive: true, capture: true });
    }
    update();
  }

  function detach() {
    if (composer && inputListener) {
      composer.removeEventListener("input", inputListener);
    }
    window.removeEventListener("resize", update);
    window.removeEventListener("scroll", update, true);
    composer = null;
    anchor = null;
    inputListener = null;
    if (host && host.isConnected) {
      host.remove();
    }
    host = null;
    shadow = null;
    button = null;
    label = null;
  }

  var api = {
    attach: attach,
    detach: detach,
    update: update,
    setBusy: setBusy
  };

  root.Clarify = Object.assign(root.Clarify || {}, { fixButton: api });
})(typeof globalThis !== "undefined" ? globalThis : window);
