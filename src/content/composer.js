(function (root) {
  "use strict";

  var SELECTORS = {
    chatgpt: [
      "textarea[data-testid='prompt-textarea']",
      "div[contenteditable='true'][data-placeholder*='Message' i]",
      "textarea[placeholder*='Message' i]"
    ],
    gemini: [
      "rich-textarea div[contenteditable='true']",
      "div[contenteditable='true'][aria-label*='prompt' i]",
      "textarea[aria-label*='prompt' i]"
    ],
    qwen: [
      "textarea[placeholder*='prompt' i]",
      "textarea[placeholder*='message' i]",
      "textarea[placeholder*='ask' i]",
      "div[contenteditable='true'][aria-label*='prompt' i]"
    ],
    deepseek: [
      "textarea[placeholder*='message' i]",
      "textarea[placeholder*='ask' i]",
      "div[contenteditable='true'][aria-label*='message' i]"
    ]
  };

  var EDITABLE_SELECTOR = "textarea:not([disabled]):not([readonly]), [contenteditable='true']";

  function safeMatches(element, selector) {
    try {
      return element.matches(selector);
    } catch (error) {
      return false;
    }
  }

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }
    var style = window.getComputedStyle(element);
    var rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" &&
      rect.width > 0 && rect.height > 0;
  }

  function getLabel(element) {
    return [
      element.getAttribute("placeholder"),
      element.getAttribute("aria-label"),
      element.getAttribute("data-placeholder"),
      element.getAttribute("title")
    ].filter(Boolean).join(" ");
  }

  function selectorScore(element, siteId) {
    return (SELECTORS[siteId] || []).reduce(function (score, selector) {
      return score + (safeMatches(element, selector) ? 35 : 0);
    }, 0);
  }

  function scoreComposer(element, siteId, preferred) {
    if (!isVisible(element)) {
      return -Infinity;
    }

    var label = getLabel(element);
    var score = selectorScore(element, siteId);
    if (element === preferred) {
      score += 100;
    }
    if (element === document.activeElement || element.contains(document.activeElement)) {
      score += 35;
    }
    if (/message|prompt|ask|enter|type/i.test(label)) {
      score += 40;
    }
    if (/search|password|email|comment|feedback|title/i.test(label)) {
      score -= 80;
    }
    if (element.tagName === "TEXTAREA") {
      score += 10;
    }
    if (element.closest("form")) {
      score += 5;
    }
    return score;
  }

  function findComposer(siteId, preferred) {
    var elements = Array.prototype.slice.call(document.querySelectorAll(EDITABLE_SELECTOR));
    var best = null;
    var bestScore = -Infinity;
    elements.forEach(function (element) {
      var score = scoreComposer(element, siteId, preferred);
      if (score > bestScore) {
        best = element;
        bestScore = score;
      }
    });
    return best;
  }

  function getText(element) {
    if (!element) {
      return "";
    }
    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    return typeof element.innerText === "string" ? element.innerText : element.textContent || "";
  }

  function dispatchInput(element, text) {
    var event;
    if (typeof InputEvent === "function") {
      event = new InputEvent("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: text
      });
    } else {
      event = new Event("input", { bubbles: true, composed: true });
    }
    element.dispatchEvent(event);
  }

  function setText(element, text) {
    if (!element) {
      return false;
    }
    var value = String(text);
    if (element instanceof HTMLTextAreaElement) {
      var descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
      dispatchInput(element, value);
      return true;
    }

    element.focus();
    var selection = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);

    var fragment = document.createDocumentFragment();
    var lines = value.split("\\n");
    lines.forEach(function (line) {
      var paragraph = document.createElement("p");
      paragraph.textContent = line;
      fragment.appendChild(paragraph);
    });
    if (!lines.length) {
      fragment.appendChild(document.createElement("p"));
    }
    element.replaceChildren(fragment);
    dispatchInput(element, value);
    return true;
  }

  function nearestControl(target) {
    if (!target || !target.closest) {
      return null;
    }
    return target.closest("button, [role='button'], input[type='submit']");
  }

  function controlLabel(element) {
    if (!element) {
      return "";
    }
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-test-id"),
      element.getAttribute("data-tooltip"),
      element.getAttribute("title"),
      element.textContent
    ].filter(Boolean).join(" ").trim();
  }

  function isSendControl(target) {
    var control = nearestControl(target) || target;
    if (!control || !control.matches || !isVisible(control)) {
      return false;
    }
    var label = controlLabel(control);
    if (/stop|cancel|regenerate|feedback/i.test(label)) {
      return false;
    }
    return /(^|[-_\s])(send|submit)([-_\s]|$)/i.test(label) ||
      /send|submit/i.test(label) && control.tagName === "BUTTON";
  }

  function findSendControl(composer, siteId) {
    var selectors = [
      "button[data-testid*='send' i]",
      "button[data-test-id*='send' i]",
      "button[aria-label*='send' i]",
      "button[data-tooltip*='send' i]",
      "[role='button'][aria-label*='send' i]",
      "input[type='submit']"
    ];
    var candidates = Array.prototype.slice.call(document.querySelectorAll(selectors.join(",")));
    var form = composer && composer.closest("form");
    var best = null;
    var bestScore = -Infinity;
    candidates.forEach(function (candidate) {
      if (!isVisible(candidate)) {
        return;
      }
      var score = 0;
      if (form && candidate.closest("form") === form) {
        score += 100;
      }
      if (siteId === "chatgpt" && safeMatches(candidate, "[data-testid='send-button']")) {
        score += 50;
      }
      var rect = candidate.getBoundingClientRect();
      var composerRect = composer && composer.getBoundingClientRect();
      if (composerRect && rect.top >= composerRect.top - 100 && rect.bottom <= composerRect.bottom + 150) {
        score += 25;
      }
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    });
    return best;
  }

  function watchComposer(siteId, callback) {
    var current = null;
    var scheduled = false;
    var observer = new MutationObserver(function () {
      if (scheduled) {
        return;
      }
      scheduled = true;
      window.setTimeout(function () {
        scheduled = false;
        if (!current || !current.isConnected) {
          current = findComposer(siteId, current);
          callback(current);
        }
      }, 50);
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    current = findComposer(siteId);
    callback(current);

    return {
      getCurrent: function () { return current; },
      refresh: function () {
        current = findComposer(siteId, current);
        callback(current);
      },
      disconnect: function () { observer.disconnect(); }
    };
  }

  var api = {
    findComposer: findComposer,
    getText: getText,
    setText: setText,
    isSendControl: isSendControl,
    findSendControl: findSendControl,
    watchComposer: watchComposer,
    SELECTORS: SELECTORS
  };

  root.Clarify = Object.assign(root.Clarify || {}, { composer: api });
})(typeof globalThis !== "undefined" ? globalThis : window);
