# Clarify

A Chromium Manifest V3 extension that rewrites your AI prompt for maximum clarity right before it is submitted. Works on ChatGPT, Gemini, Qwen, and DeepSeek.

## How it works

- Press Enter or the send button; Clarify polishes the prompt with Gemini first, then submits it.
- Meaning, language, code, links, and quotes are preserved. If Gemini fails or times out, the original prompt goes through untouched.
- An optional on-page **Clarify** button rewrites without submitting, and an **Undo** chip restores the original text.
- The Gemini API key stays in local extension storage. No build step, no dependencies, no telemetry.

## Setup

1. Open `chrome://extensions`, enable **Developer mode**, and **Load unpacked** this folder.
2. Open Clarify **Settings**, paste your Gemini API key, hit **Detect Available Models**, then **Save**.
3. Refresh any open chat tabs.

```sh
node tests/segment.test.js
node tests/gemini.test.js
node tests/background.test.js
node tests/diagnostics.test.js
node tests/settings.test.js
```
