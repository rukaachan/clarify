(function (root) {
  "use strict";

  function addRegexRanges(text, ranges, regex, kind) {
    var match;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      var start = match.index;
      var end = start + match[0].length;
      if (end > start) {
        ranges.push({ start: start, end: end, kind: kind });
      }
      if (match[0] === "") {
        regex.lastIndex += 1;
      }
    }
  }

  function addSingleQuoteRanges(text, ranges) {
    var regex = /(^|[\s([{])'([^'\r\n]+)'(?=$|[\s)\]},.!?;:])/gm;
    var match;
    while ((match = regex.exec(text)) !== null) {
      var prefixLength = match[1].length;
      var start = match.index + prefixLength;
      var end = start + match[0].length - prefixLength;
      if (end > start) {
        ranges.push({ start: start, end: end, kind: "quote" });
      }
    }
  }

  function mergeRanges(ranges) {
    var kindPriority = {
      quote: 1,
      placeholder: 2,
      url: 3,
      "inline-code": 4,
      "code-fence": 5,
      protected: 0
    };
    return ranges
      .slice()
      .sort(function (left, right) {
        return left.start - right.start || right.end - left.end;
      })
      .reduce(function (merged, range) {
        var previous = merged[merged.length - 1];
        if (previous && range.start <= previous.end) {
          previous.end = Math.max(previous.end, range.end);
          if ((kindPriority[range.kind] || 0) > (kindPriority[previous.kind] || 0)) {
            previous.kind = range.kind;
          }
        } else {
          merged.push({ start: range.start, end: range.end, kind: range.kind });
        }
        return merged;
      }, []);
  }

  function protectedRanges(text) {
    var ranges = [];

    // A closed or unterminated fence is protected through the end of the prompt.
    addRegexRanges(text, ranges, /```[\s\S]*?(?:```|$)/g, "code-fence");
    addRegexRanges(text, ranges, /`[^`\r\n]*`/g, "inline-code");
    addRegexRanges(
      text,
      ranges,
      /\b(?:https?:\/\/|www\.)[^\s<>'"`]+/gi,
      "url"
    );

    // Common template and prompt placeholders.
    addRegexRanges(text, ranges, /\{\{[\s\S]*?\}\}/g, "placeholder");
    addRegexRanges(text, ranges, /\$\{[\s\S]*?\}/g, "placeholder");
    addRegexRanges(text, ranges, /\$[A-Za-z_][A-Za-z0-9_]*/g, "placeholder");
    addRegexRanges(text, ranges, /\[\/?[A-Z][A-Za-z0-9_.:-]*(?:\s[^\]]*)?\]/g, "placeholder");
    addRegexRanges(text, ranges, /<[A-Z][A-Za-z0-9_.:-]*(?:\s[^>]*)?>/g, "placeholder");

    // Quoted examples are part of the prompt's content, not prose to rewrite.
    addRegexRanges(text, ranges, /"(?:\\.|[^"\\\r\n])*"/g, "quote");
    addRegexRanges(text, ranges, /“[^”\r\n]*”/g, "quote");
    addRegexRanges(text, ranges, /‘[^’\r\n]*’/g, "quote");
    addSingleQuoteRanges(text, ranges);

    return mergeRanges(ranges);
  }

  function segmentText(text) {
    var source = String(text == null ? "" : text);
    if (!source) {
      return [];
    }

    var ranges = protectedRanges(source);
    var segments = [];
    var cursor = 0;

    ranges.forEach(function (range) {
      if (range.start > cursor) {
        segments.push({
          type: "prose",
          text: source.slice(cursor, range.start),
          start: cursor,
          end: range.start
        });
      }
      segments.push({
        type: "protected",
        kind: range.kind,
        text: source.slice(range.start, range.end),
        start: range.start,
        end: range.end
      });
      cursor = range.end;
    });

    if (cursor < source.length) {
      segments.push({
        type: "prose",
        text: source.slice(cursor),
        start: cursor,
        end: source.length
      });
    }

    return segments;
  }

  function rangeOverlapsProtected(ranges, start, end) {
    return ranges.some(function (range) {
      return start < range.end && end > range.start;
    });
  }

  var api = {
    protectedRanges: protectedRanges,
    segmentText: segmentText,
    rangeOverlapsProtected: rangeOverlapsProtected
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.Clarify = Object.assign(root.Clarify || {}, api);
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
