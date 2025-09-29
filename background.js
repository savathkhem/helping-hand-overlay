const OVERLAY_SCRIPT = "overlay.js";
const OVERLAY_CSS = "overlay.css";
const NON_CAPTURABLE_SCHEMES = ["chrome:", "chrome-extension:", "edge:", "about:", "moz-extension:"];
const PENDING_CAPTURE_KEY = "hh-pending-capture";

function storePendingCapture(data) {
  return new Promise((resolve) => {
    if (!data) {
      chrome.storage.local.remove(PENDING_CAPTURE_KEY, () => {
        if (chrome.runtime.lastError) {
          console.warn("Failed to clear pending capture", chrome.runtime.lastError.message);
        }
        resolve();
      });
      return;
    }

    const payload = { ...data, createdAt: Date.now() };
    chrome.storage.local.set({ [PENDING_CAPTURE_KEY]: payload }, () => {
      if (chrome.runtime.lastError) {
        console.warn("Failed to store pending capture", chrome.runtime.lastError.message);
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
        console.warn("Failed to deliver message", message, msg);
      }
    }
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || !message.type) {
    return;
  }

  switch (message.type) {
    case "hh-start-selection": {
      handleStartSelection();
      break;
    }
    case "hh-selection-region": {
      handleSelectionResult(message.payload, "region");
      break;
    }
    case "hh-selection-full": {
      handleSelectionResult(message.payload, "full");
      break;
    }
    case "hh-selection-cancel": {
      storePendingCapture(null);
      safeSendMessage({ type: "hh-selection-cancelled" });
      break;
    }
    default:
      break;
  }
});

async function handleStartSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.id === undefined) {
      const message = "No active tab";
      await storePendingCapture({ error: message });
      safeSendMessage({ type: "hh-selection-error", error: message });
      return;
    }

    if (!canCaptureTab(tab)) {
      const message = "Cannot capture this tab. Try a standard web page.";
      await storePendingCapture({ error: message });
      safeSendMessage({ type: "hh-selection-error", error: message });
      return;
    }

    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: [OVERLAY_CSS] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [OVERLAY_SCRIPT] });
  } catch (error) {
    const message = error?.message || "Overlay injection failed";
    console.error("Failed to start selection:", error);
    await storePendingCapture({ error: message });
    safeSendMessage({ type: "hh-selection-error", error: message });
  }
}

async function handleSelectionResult(payload, mode) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.id === undefined) {
      const message = "No active tab";
      await storePendingCapture({ error: message });
      safeSendMessage({ type: "hh-selection-error", error: message });
      return;
    }

    if (!canCaptureTab(tab)) {
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
    console.error("Failed to capture tab:", error);
    await storePendingCapture({ error: message });
    safeSendMessage({
      type: "hh-selection-error",
      error: message,
    });
  }
}

function canCaptureTab(tab) {
  const url = tab.url || "";
  return !NON_CAPTURABLE_SCHEMES.some((scheme) => url.startsWith(scheme));
}


