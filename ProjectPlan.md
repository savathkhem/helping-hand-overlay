# Project: Helping Hand Overlay

> Status note (2025‑09‑29): The plan below has been reworked. The legacy MVP roadmap remains for historical context, but the active plan is the Svelte-based Unified UI Overhaul described next.

---

## Unified UI Overhaul (Active Plan)

Goals
- Unify all surfaces (popup, side panel, in‑page modal, overlay) under a single Svelte UI.
- Reuse existing capture, storage, speech, and model logic via thin adapters.
- Ship incrementally behind a settings flag; keep legacy UI as fallback until parity.

Deliverables
- Svelte app in `src/` with components matching the mock (`mockup_app-shell.html`).
- Build output in `dist/` (JS/CSS) loaded by all surfaces when enabled.
- Service adapters: storage, model provider, speech, capture, surface routing.
- Accessibility upgrades (aria labels, focus management, keyboard navigation).

Milestones
1) Scaffold Svelte + Vite project; render static mock as components.
2) Add stores (ui/chat/history/capture/settings) and replace placeholders with SVG icons + a11y.
3) Integrate chat send/receive via model service abstraction.
4) Integrate history list/paging with `CaptureStorage`.
5) Integrate capture flow (image/video) and pending‑capture replay.
6) Replace overlay UI to open the unified modal shell; persist size/position.
7) QA across surfaces; performance polish; error states.
8) Flip default to Svelte UI; retire legacy UI.

Risks & Mitigations
- Manifest and iframe access: expose `dist/*` via `web_accessible_resources`; validate CSP.
- Cross‑surface state: centralize via adapters and persisted settings; avoid direct DOM coupling.
- Rollout safety: settings flag toggles `legacy` vs `svelte`; easy rollback.

Tracking
- Use this document to track milestone status and decisions. Link code PRs under each milestone as they land.

---

## Legacy MVP Plan (Archived for Reference)

The following sections describe the original MVP roadmap and notes. They remain for context but are no longer the active plan.

### Current Status: MVP Complete

We have a working Chrome extension that can:
- Capture a screenshot of the current tab, including selective region via in-page overlay.
- Transcribe user voice into a text prompt.
- Send the image and text to the Gemini API and display the response.
- Persist recent activity (prompt/response + screenshot thumbnail) across sessions.
- Manage API key/model/version from a Settings page (stored locally via chrome.storage).

---

## Roadmap & Goals (Legacy)

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
- [x] Add the ability to handle short video recordings.
- [ ] Add annotation tools for screenshots after capture.

### Todo List
- [x] Persist transcript/history across popup sessions.
- [x] Associate responses with history entries so past answers are easy to review.
- [ ] Add setting to choose UI surface (popup dropdown vs. side panel) and remember preference.
- [x] Draft concrete schemas and adapter API for capture-centric storage (captures, messages, thumbnails, IDB blobs) before implementation.
- [x] Refactor to capture-centric workflow (captures own chat thread; remove separate voice history).
- [x] Storage refactor: thumbnails in `chrome.storage.local`, full media in IndexedDB; add retention policy and optional `unlimitedStorage`.
- [x] Resilient capture pipeline: pending-capture storage, popup replay, and debug instrumentation.
- [x] Add Options model catalog cache (list models per provider; allow selection in Settings).
- [ ] Accessibility (ARIA roles/labels; focus management) and extension `content_security_policy` for hardening. **Next focus**

// Video recording workflow overhaul
- [ ] Keep overlay visible during video recording (no auto-close on start).
- [ ] Overlay "Video" button shows recording state (red) and countdown (sync with timeout).
- [ ] Require "Confirm" in overlay to commit recording to history; "Cancel" stops and discards.
- [ ] Background forwards a new `hh-video-confirm` message to popup.
- [ ] Popup stages processed video (preview + thumbnail) and only persists on confirm (decouple processing from persistence).
- [ ] Overlay stops recording before confirm/cancel; countdown stops on timeout or manual stop.

// UI surfaces and modal/window
- [ ] Respect preferred UI surface for toolbar icon (Popup, Side Panel, In‑Page Modal, Floating Window).
- [ ] Add secondary keyboard shortcut (commands) to toggle the in‑page modal directly.
- [ ] Implement in‑page modal via iframe (isolation) that loads the shared app shell (ui.js/popup.js/popup.css).
- [ ] Add "Dock to side" mode for the modal (left/right drawer), resizable width, with smooth transitions.
- [ ] Persist modal/window bounds (position/size/dock state) in `chrome.storage.local` and restore on open.
- [ ] Background routing: open preferred surface; avoid targeting extension windows when launching overlay/capture.
- [ ] Manifest updates: add `commands` for modal toggle; expose modal assets in `web_accessible_resources`.
- [ ] A11y: focus trap in modal, Escape to close, return focus to page, proper roles/labels.
- [ ] QA: verify screenshot/video/voice flows work identically across all surfaces.

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
* 2025-09-28: Refactored storage to unify history and capture management under `CaptureStorage`. -- Gemini
* 2025-09-28: Added short screen recording capture with storage + Gemini submission support. --Codex
* 2025-09-28: Added Gemini model catalog cache with TTL-backed refresh in Settings. --Codex
* 2025-09-28: Hardened capture flow with pending storage replay and debug tooling. --Codex
* 2025-09-28: Reduced UI code duplication by creating a shared `ui.js` and `shared.css`. -- Gemini
* 2025-09-28: Improved modularity by extracting speech recognition and Gemini API calls into `speech.js` and `gemini.js`. -- Gemini
* 2025-09-27: Added Settings page (provider/model/API key) and wired popup to read from local settings. --GPT5
* 2025-09-27: Persisted prompt/response history with chrome.storage and updated popup activity log. --GPT5
* 2025-09-27: Added in-page selection overlay, background capture pipeline, and cropping logic to enable precise screenshots. --GPT5
* 2025-09-27: Polished the popup UI, added loading indicators, and scaffolded transcript history to kick off Phase 2. --GPT5
* 2025-09-27: Successfully completed and tested MVP functionality. The core loop of capture -> transcribe -> query -> display is working.

---

## Notes & Ideas
*(A place for random thoughts and brainstorming.)*
### Debug Utilities
- Added `__hhDebug` helper and verbose `[HH]` logs for capture/storage troubleshooting.
- Gemini model catalog cached for 60 minutes (`hh-model-cache`) with on-demand refresh in Settings.
- Added `__hhDebug` helper and verbose `[HH]` logs for capture/storage troubleshooting.

## Capture-Centric Storage Draft

### Entities
- **Capture**: `{ id, createdAt, updatedAt, status, prompt, response, provider, mode, selection, threadId, attachments, thumbnailKey }`
  - `attachments.screenshot`: `{ blobKey, mimeType, size }`
  - `attachments.audio`: `{ blobKey, mimeType, durationMs }`
  - `attachments.video`: `{ blobKey, mimeType, durationMs }`
- **Message**: `{ id, captureId, role, text, createdAt, tokens, model }`
- **Thread**: `{ id, captureId, createdAt, updatedAt, title, messageIds }`

All metadata, thumbnails, and lightweight fields live in `chrome.storage.local`. Binary payloads (e.g., full-resolution screenshots, audio, and video clips) live in IndexedDB object store `captureBlobs` keyed by `<captureId>:<kind>`.

### Adapter API
- `CaptureStorage.init()` - open IndexedDB, create object stores, enforce retention policy.
- `CaptureStorage.upsertCapture(partial)` - merge-in metadata updates and persist thumbnail data URL.
- `CaptureStorage.saveBlob(captureId, kind, blob)` - persist binary payload; returns blob key.
- `CaptureStorage.getBlob(captureId, kind)` - fetch binary payload for replay/export.
- `CaptureStorage.listRecentCaptures(limit)` - hydrate captures with thumbnails for UI.
- `CaptureStorage.deleteCapture(id)` - remove metadata, thumbnail, and any blobs.
- `CaptureStorage.enforceRetention(policy)` - trim captures by max entries + age and pre-emptively clean blobs.

### Retention Policy
Default: keep <= 50 captures, max age 14 days. Policy is configurable and can be overridden per surface (popup/side panel/background). We optionally request `unlimitedStorage` when user enables "keep history indefinitely".

### Next Integration Steps
1. Replace legacy `hh-history` array with `CaptureStorage` adapter in popup + side panel.
2. Promote captures to their own chat thread structure (each capture owns a message timeline).
3. Wire Options page to cache provider/model catalogs in `chrome.storage.local` (`hh-model-cache`) with timestamp + TTL.
4. Harden accessibility: ARIA roles for transcript list, focus return after closing overlay, ensure screen reader text for status updates, and declare content security policy in manifest.
