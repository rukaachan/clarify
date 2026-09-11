# Privacy

Clarify uses Gemini as its only correction service.

## Gemini correction

When the extension is enabled and a Gemini API key is configured:

- The text in the active chat composer is sent to Google's Gemini API through the extension's Manifest V3 service worker.
- Gemini is instructed to improve grammar and clarify wording in the input language. It must not translate the prompt to English.
- The request uses the user's own API key and the model selected automatically from that key's available `generateContent` models.
- The API key is stored in Chrome extension local storage under a separate key. It is not placed in page DOM, content-script messages, source code, or this repository.
- If the key is missing, Gemini is unavailable, or the response fails validation, the original prompt is preserved and submitted unchanged.
- The extension does not retain submitted prompts, correction results, or request logs. Privacy-safe diagnostic events contain only site, mode, reason, change count, and timing.
- Google may process or retain requests according to the user's Google AI/Gemini API terms, account settings, and applicable policies. The extension cannot control Google's handling of transmitted text.
- Protected fragments are validated in the returned output; protection does not mean those fragments are omitted from the Gemini request.

Use a restricted API key, enable only the Gemini API, set a quota, and do not use a personal key in an extension build you distribute to untrusted users. A public multi-user product should use a backend proxy with its own authentication and abuse controls instead of shipping or collecting user keys.

## Site access

The content script runs only on these HTTPS origins:

- `chat.openai.com` and `chatgpt.com`
- `gemini.google.com`
- `chat.qwen.ai`
- `chat.deepseek.com`

It does not inspect unrelated tabs or fields outside the primary chat composer on those sites.
