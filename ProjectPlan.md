# Project: Helping Hand Overlay

**Mission:** To create a user-friendly tool that provides on-demand AI assistance over any application, allowing users to ask questions using screenshots, screen recordings, and voice prompts.

---

## Current Status: MVP Complete

We have a working Chrome extension that can:
- Capture a screenshot of the current tab, including selective region via in-page overlay.
- Transcribe user voice into a text prompt.
- Send the image and text to the Gemini API and display the response.
- Persist recent activity (prompt/response + screenshot thumbnail) across sessions.
- Manage API key/model/version from a Settings page (stored locally via chrome.storage).

---

## Roadmap & Goals

### Phase 1: MVP - Chrome Extension
- [x] Basic UI (`popup.html`).
- [x] Screenshot capture (`chrome.tabs.captureVisibleTab`).
- [x] Voice-to-text transcription (`Web Speech API`).
- [x] Send data to Gemini API.
- [x] Display text response.

### Phase 2: Polish the Extension
- [x] Improve the UI/UX.
- [x] Allow capturing a selected area instead of the whole tab (or add markup tools).
- [x] Add a settings page to choose provider/model and store API key locally (`chrome.storage`).
- [ ] Add the ability to handle short video recordings.
- [ ] Add annotation tools for screenshots after capture.

### Todo List
- [x] Persist transcript/history across popup sessions.
- [x] Associate responses with history entries so past answers are easy to review.
- [ ] Add setting to choose UI surface (popup dropdown vs. side panel) and remember preference.
- [ ] Draft concrete schemas and adapter API for capture-centric storage (captures, messages, thumbnails, IDB blobs) before implementation.
- [ ] Refactor to capture-centric workflow (captures own chat thread; remove separate voice history).
- [ ] Storage refactor: thumbnails in `chrome.storage.local`, full media in IndexedDB; add retention policy and optional `unlimitedStorage`.
- [ ] Add Options model catalog cache (list models per provider; allow selection in Settings).
- [ ] Accessibility (ARIA roles/labels; focus management) and extension `content_security_policy` for hardening.

### Phase 3: Desktop Application
- [ ] Choose a framework (for example, Electron or Tauri).
- [ ] Rebuild the extension's functionality as a desktop overlay.
- [ ] Implement system-wide screen capture.
- [ ] Add a global keyboard shortcut to launch the overlay.

### Future Ideas
- [ ] Real-time "live view" mode.
- [ ] LLM-agnostic architecture (pluggable APIs for different models).

---

## Changelog
* 2025-09-27: Added Settings page (provider/model/API key) and wired popup to read from local settings. --GPT5
* 2025-09-27: Persisted prompt/response history with chrome.storage and updated popup activity log. --GPT5
* 2025-09-27: Added in-page selection overlay, background capture pipeline, and cropping logic to enable precise screenshots. --GPT5
* 2025-09-27: Polished the popup UI, added loading indicators, and scaffolded transcript history to kick off Phase 2. --GPT5
* 2025-09-27: Successfully completed and tested MVP functionality. The core loop of capture -> transcribe -> query -> display is working.

---

## Notes & Ideas
*(A place for random thoughts and brainstorming.)*
