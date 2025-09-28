const OVERLAY_SCRIPT = "overlay.js";
const OVERLAY_CSS = "overlay.css";
const NON_CAPTURABLE_SCHEMES = ["chrome:", "chrome-extension:", "edge:", "about:", "moz-extension:"];

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
      chrome.runtime.sendMessage({ type: "hh-selection-cancelled" });
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
      chrome.runtime.sendMessage({ type: "hh-selection-error", error: "No active tab" });
      return;
    }

    if (!canCaptureTab(tab)) {
      chrome.runtime.sendMessage({ type: "hh-selection-error", error: "Cannot capture this tab. Try a standard web page." });
      return;
    }

    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: [OVERLAY_CSS] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [OVERLAY_SCRIPT] });
  } catch (error) {
    console.error("Failed to start selection:", error);
    chrome.runtime.sendMessage({ type: "hh-selection-error", error: error?.message || "Overlay injection failed" });
  }
}

async function handleSelectionResult(payload, mode) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || tab.id === undefined) {
      chrome.runtime.sendMessage({ type: "hh-selection-error", error: "No active tab" });
      return;
    }

    if (!canCaptureTab(tab)) {
      chrome.runtime.sendMessage({
        type: "hh-selection-error",
        error: "Cannot capture this tab. Try a standard web page."
      });
      return;
    }

    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });

    chrome.runtime.sendMessage({
      type: "hh-selection-result",
      payload: {
        mode,
        screenshotDataUrl,
        selection: payload?.selection || null
      }
    });
  } catch (error) {
    console.error("Failed to capture tab:", error);
    chrome.runtime.sendMessage({
      type: "hh-selection-error",
      error: error?.message || "Failed to capture tab"
    });
  }
}

function canCaptureTab(tab) {
  const url = tab.url || "";
  return !NON_CAPTURABLE_SCHEMES.some((scheme) => url.startsWith(scheme));
}
