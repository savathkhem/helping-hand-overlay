// --- constants (yours) ---
const OVERLAY_SCRIPT = "overlay.js";
const OVERLAY_CSS = "overlay.css";
const NON_CAPTURABLE_SCHEMES = ["chrome:", "chrome-extension:", "edge:", "about:", "moz-extension:"];
const PENDING_CAPTURE_KEY = "hh-pending-capture";

// --- debounce + better tab selection ---
let lastModalInjectAt = 0;
const MODAL_INJECT_DEBOUNCE_MS = 250;

async function queryBestTab() {
  // Prefer the active tab in the focused window
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active?.id && isInjectable(active)) return active;

  // Then try any http/https tab
  const [http] = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  if (http?.id && isInjectable(http)) return http;

  // Lastly, any normal tab
  const [anyTab] = await chrome.tabs.query({ windowType: "normal" });
  if (anyTab?.id && isInjectable(anyTab)) return anyTab;

  return null;
}

function isInjectable(tab) {
  const url = tab.url || "";
  return !NON_CAPTURABLE_SCHEMES.some((s) => url.startsWith(s));
}

async function injectModalOnce() {
  const now = Date.now();
  if (now - lastModalInjectAt < MODAL_INJECT_DEBOUNCE_MS) {
    console.log("[HH] injectModalOnce: debounced");
    return;
  }
  lastModalInjectAt = now;

  const tab = await queryBestTab();
  if (!tab?.id) throw new Error("No suitable tab to inject modal");

  console.log("[HH] injecting modal into tab", tab.id, tab.url);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["modal.js"],
  });
}

// --- NEW: toolbar icon -> modal ---
chrome.action.onClicked.addListener(async () => {
  try {
    await injectModalOnce();
  } catch (e) {
    console.warn("Action click: modal inject failed; falling back to window", e);
    await chrome.windows.create({
      url: chrome.runtime.getURL("app-shell.html"),
      type: "popup",
      width: 980,
      height: 720,
    });
  }
});

// --- commands (keep) ---
chrome.commands.onCommand.addListener(async (command) => {
  try {
    if (command === "toggle_modal") {
      await injectModalOnce();
      return;
    }
    if (command === "open_tool_window") {
      await chrome.windows.create({
        url: chrome.runtime.getURL("app-shell.html"),
        type: "popup",
        width: 980,
        height: 720,
      });
    }
  } catch (e) {
    console.warn("Command handling failed", command, e);
  }
});

// --- messages (keep) ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message?.type) return;

    if (message.type === "hh-open-modal") {
      try {
        await injectModalOnce();
        sendResponse?.({ ok: true });
      } catch (e) {
        console.warn("Failed to open modal; falling back to window", e);
        await chrome.windows.create({
          url: chrome.runtime.getURL("app-shell.html"),
          type: "popup",
          width: 980,
          height: 720,
        });
        sendResponse?.({ ok: false, fallback: "window" });
      }
      return;
    }

    if (message.type === "hh-open-window") {
      try {
        await chrome.windows.create({
          url: chrome.runtime.getURL("app-shell.html"),
          type: "popup",
          width: 980,
          height: 720,
        });
        sendResponse?.({ ok: true });
      } catch (e) {
        console.warn("Failed to open tool window", e);
        sendResponse?.({ ok: false, error: e?.message || "window-open-failed" });
      }
      return;
    }

    // ... your selection handlers unchanged ...
  })();

  return true; // keep channel open for async sendResponse
});
