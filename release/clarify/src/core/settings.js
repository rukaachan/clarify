(function (root) {
  "use strict";

  var STORAGE_KEY = "clarifySettings";
  var API_KEY_STORAGE_KEY = "clarifyGeminiApiKey";
  var DEFAULT_SYSTEM_PROMPT = "Clarify the user’s request and goal, then rewrite it clearly according to the greatest principle. Preserve the original language and intent. Do not add information or change the request. Focus only on improving clarity.";
  var DEFAULTS = {
    enabled: true,
    sites: {
      chatgpt: true,
      gemini: true,
      qwen: true,
      deepseek: true
    },
    gemini: {
      timeoutMs: 5000,
      systemPrompt: DEFAULT_SYSTEM_PROMPT
    }
  };
  var cache = clone(DEFAULTS);
  var loaded = false;
  var loadPromise;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function storageGet(keys) {
    return new Promise(function (resolve) {
      if (!root.chrome || !chrome.storage || !chrome.storage.local) {
        resolve({});
        return;
      }
      try {
        chrome.storage.local.get(keys, resolve);
      } catch (error) {
        resolve({});
      }
    });
  }

  function storageSet(value) {
    return new Promise(function (resolve) {
      if (!root.chrome || !chrome.storage || !chrome.storage.local) {
        resolve();
        return;
      }
      try {
        chrome.storage.local.set(value, resolve);
      } catch (error) {
        resolve();
      }
    });
  }

  function asBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
  }

  function asBoundedInteger(value, fallback, minimum, maximum) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(maximum, Math.max(minimum, Math.round(number)));
  }

  function normalize(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var rawSites = source.sites && typeof source.sites === "object" ? source.sites : {};
    var rawGemini = source.gemini && typeof source.gemini === "object" ? source.gemini : {};
    var systemPrompt = typeof rawGemini.systemPrompt === "string" ? rawGemini.systemPrompt.trim().slice(0, 4000) : "";
    return {
      enabled: asBoolean(source.enabled, DEFAULTS.enabled),
      sites: {
        chatgpt: asBoolean(rawSites.chatgpt, DEFAULTS.sites.chatgpt),
        gemini: asBoolean(rawSites.gemini, DEFAULTS.sites.gemini),
        qwen: asBoolean(rawSites.qwen, DEFAULTS.sites.qwen),
        deepseek: asBoolean(rawSites.deepseek, DEFAULTS.sites.deepseek)
      },
      gemini: {
        timeoutMs: asBoundedInteger(rawGemini.timeoutMs, DEFAULTS.gemini.timeoutMs, 1000, 10000),
        systemPrompt: systemPrompt || DEFAULTS.gemini.systemPrompt
      }
    };
  }

  function load() {
    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = storageGet(STORAGE_KEY).then(function (stored) {
      cache = normalize(stored && stored[STORAGE_KEY]);
      loaded = true;
      return clone(cache);
    });

    return loadPromise;
  }

  function getCached() {
    return clone(cache);
  }

  function save(next) {
    cache = normalize(next);
    loaded = true;
    var value = {};
    value[STORAGE_KEY] = cache;
    return storageSet(value).then(function () {
      return clone(cache);
    });
  }

  function getApiKey() {
    return storageGet(API_KEY_STORAGE_KEY).then(function (stored) {
      return typeof stored[API_KEY_STORAGE_KEY] === "string" ? stored[API_KEY_STORAGE_KEY] : "";
    });
  }

  function saveApiKey(apiKey) {
    var value = {};
    value[API_KEY_STORAGE_KEY] = typeof apiKey === "string" ? apiKey.trim() : "";
    return storageSet(value);
  }

  function getSiteId(hostname) {
    var host = String(hostname || "").toLowerCase().replace(/^www\./, "");
    if (host === "chat.openai.com" || host === "chatgpt.com" || host.endsWith(".chatgpt.com")) {
      return "chatgpt";
    }
    if (host === "gemini.google.com" || host.endsWith(".gemini.google.com")) {
      return "gemini";
    }
    if (host === "chat.qwen.ai" || host.endsWith(".chat.qwen.ai")) {
      return "qwen";
    }
    if (host === "chat.deepseek.com" || host.endsWith(".chat.deepseek.com")) {
      return "deepseek";
    }
    return null;
  }

  function isSiteEnabled(settings, siteId) {
    return Boolean(settings && settings.enabled && siteId && settings.sites && settings.sites[siteId]);
  }

  if (root.chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName !== "local" || !changes[STORAGE_KEY]) {
        return;
      }
      cache = normalize(changes[STORAGE_KEY].newValue);
      loaded = true;
    });
  }

  var api = {
    DEFAULTS: clone(DEFAULTS),
    STORAGE_KEY: STORAGE_KEY,
    API_KEY_STORAGE_KEY: API_KEY_STORAGE_KEY,
    load: load,
    save: save,
    getCached: getCached,
    getApiKey: getApiKey,
    saveApiKey: saveApiKey,
    getSiteId: getSiteId,
    isSiteEnabled: isSiteEnabled,
    isLoaded: function () { return loaded; },
    normalize: normalize
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Clarify = Object.assign(root.Clarify || {}, { settings: api });
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
