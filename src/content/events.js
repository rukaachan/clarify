(function (root) {
  "use strict";

  var controller = root.Clarify && root.Clarify.controller;
  if (!controller) {
    return;
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) {
      return;
    }
    if (controller.handleKeydown(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener("click", function (event) {
    if (!root.Clarify.composer.isSendControl(event.target)) {
      return;
    }
    if (controller.handleClick(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener("submit", function (event) {
    if (controller.handleFormSubmit(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})(typeof globalThis !== "undefined" ? globalThis : window);
