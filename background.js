// --- constants ---
const OVERLAY_SCRIPT = "overlay.js";
const OVERLAY_CSS = "overlay.css";
const NON_CAPTURABLE_SCHEMES = ["chrome:", "chrome-extension:", "edge:", "about:", "moz-extension:"];
const PENDING_CAPTURE_KEY = "hh-pending-capture";

// --- debounce + best-tab selection for modal inject ---
let lastModalInjectAt = 0;
const MODAL_INJECT_DEBOUNCE_MS = 250;

function isInjectable(tab) {
  if (!tab || !tab.id || !tab.url) return false;
  return !NON_CAPTURABLE_SCHEMES.some((s) => tab.url.startsWith(s));
}

async function queryBestTab() {
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (isInjectable(active)) return active;

  const [http] = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  if (isInjectable(http)) return http;

  const all = await chrome.tabs.query({ windowType: "normal" });
  const any = all.find(isInjectable);
  return any || null;
}

async function injectModalOnce() {
  const now = Date.now();
  if (now - lastModalInjectAt < MODAL_INJECT_DEBOUNCE_MS) {
    console.log("[HH:bg] injectModalOnce debounced");
    return;
  }
  lastModalInjectAt = now;

  const tab = await queryBestTab();
  if (!tab) throw new Error("No suitable tab to inject modal");
  console.log("[HH:bg] injecting modal into", tab.id, tab.url);
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["modal.js"],
  });
}

// --- toolbar icon → modal ---
chrome.action.onClicked.addListener(async () => {
  try {
    await injectModalOnce();
  } catch (e) {
    console.warn("[HH:bg] action click inject failed; fallback window", e);
    await chrome.windows.create({
      url: chrome.runtime.getURL("app-shell.html"),
      type: "popup",
      width: 980,
      height: 720,
    });
  }
});

// --- commands ---
chrome.commands.onCommand.addListener(async (command) => {
  try {
    console.log("[HH:bg] command:", command);
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
    console.warn("[HH:bg] command handler failed", command, e);
  }
});

// --- message bus ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message?.type) return;
    console.log("[HH:bg] onMessage:", message.type);

    // Open surfaces
    if (message.type === "hh-open-modal") {
      try {
        await injectModalOnce();
        sendResponse?.({ ok: true });
      } catch (e) {
        console.warn("[HH:bg] open-modal failed; fallback window", e);
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
        console.warn("[HH:bg] open-window failed", e);
        sendResponse?.({ ok: false, error: e?.message || "window-open-failed" });
      }
      return;
    }

    // Capture / selection
    switch (message.type) {
      case "hh-start-selection": {
        await handleStartSelection();
        break;
      }
      case "hh-selection-region": {
        await handleSelectionResult(message.payload, "region");
        break;
      }
      case "hh-selection-full": {
        await handleSelectionResult(message.payload, "full");
        break;
      }
      case "hh-selection-cancel": {
        await storePendingCapture(null);
        safeSendMessage({ type: "hh-selection-cancelled" });
        break;
      }

      // Video controls (forward to UI)
      case "hh-video-start": {
        await storePendingCapture(null);
        safeSendMessage({ type: "hh-video-start" });
        break;
      }
      case "hh-video-stop": {
        safeSendMessage({ type: "hh-video-stop" });
        break;
      }

      default:
        break;
    }
  })();

  return true; // keep channel open for async sendResponse
});

// --- storage helpers & messaging ---
function storePendingCapture(data) {
  return new Promise((resolve) => {
    if (!data) {
      chrome.storage.local.remove(PENDING_CAPTURE_KEY, () => {
        if (chrome.runtime.lastError) {
          console.warn("[HH:bg] clear pending capture failed", chrome.runtime.lastError.message);
        }
        resolve();
      });
      return;
    }
    const payload = { ...data, createdAt: Date.now() };
    chrome.storage.local.set({ [PENDING_CAPTURE_KEY]: payload }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[HH:bg] store pending capture failed", chrome.runtime.lastError.message);
      }
      resolve();
    });
  });
}

function safeSendMessage(message) {
  chrome.runtime.sendMessage(message, () => {
    if (chrome.runtime.lastError) {
      const msg = chrome.runtime.lastError.message || "";
      if (!msg.includes("Receiving end does not exist")) {
        console.warn("[HH:bg] sendMessage failed", message, msg);
      }
    }
  });
}

// --- selection / overlay flow ---
async function handleStartSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    console.log("[HH:bg] handleStartSelection tab:", tab?.id, tab?.url);

    if (!tab || tab.id === undefined) {
      const message = "No active tab";
      await storePendingCapture({ error: message });
      safeSendMessage({ type: "hh-selection-error", error: message });
      return;
    }

    if (!isInjectable(tab)) {
      const message = "Cannot capture this tab. Try a standard web page.";
      await storePendingCapture({ error: message });
      safeSendMessage({ type: "hh-selection-error", error: message });
      return;
    }

    console.log("[HH:bg] injecting overlay assets");
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: [OVERLAY_CSS] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [OVERLAY_SCRIPT] });
    console.log("[HH:bg] overlay injected");
  } catch (error) {
    const message = error?.message || "Overlay injection failed";
    console.error("[HH:bg] start selection failed:", error);
    await storePendingCapture({ error: message });
    safeSendMessage({ type: "hh-selection-error", error: message });
  }
}

async function handleSelectionResult(payload, mode) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    console.log("[HH:bg] handleSelectionResult tab:", tab?.id, tab?.url, "mode:", mode);

    if (!tab || tab.id === undefined) {
      const message = "No active tab";
      await storePendingCapture({ error: message });
      safeSendMessage({ type: "hh-selection-error", error: message });
      return;
    }

    if (!isInjectable(tab)) {
      const message = "Cannot capture this tab. Try a standard web page.";
      await storePendingCapture({ error: message });
      safeSendMessage({ type: "hh-selection-error", error: message });
      return;
    }

    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

    await storePendingCapture({
      mode,
      selection: payload?.selection || null,
      screenshotDataUrl,
    });

    safeSendMessage({
      type: "hh-selection-result",
      payload: {
        mode,
        screenshotDataUrl,
        selection: payload?.selection || null,
      },
    });
  } catch (error) {
    const message = error?.message || "Failed to capture tab";
    console.error("[HH:bg] capture failed:", error);
    await storePendingCapture({ error: message });
    safeSendMessage({ type: "hh-selection-error", error: message });
  }
}

// --- lifecycle cleanup (optional, as you had) ---
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove(["sessionAuth_temp"]).catch(() => {});
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(["sessionAuth_temp"]).catch(() => {});
});
