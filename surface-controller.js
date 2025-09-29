const SETTINGS_KEY = "hh-settings";

async function getSettings() {
  try {
    const res = await chrome.storage.local.get([SETTINGS_KEY]);
    return res?.[SETTINGS_KEY] || {};
  } catch (err) {
    console.warn('[HH] getSettings failed', err);
    return {};
  }
}

export async function getPreferredSurface() {
  const cfg = await getSettings();
  return cfg.uiSurface || "popup";
}

export function detectSurface() {
  const container =
    document.getElementById("popupContainer") ||
    document.getElementById("sidePanelContainer");

  const surface =
    container?.id === "sidePanelContainer"
      ? "sidepanel"
      : container?.id === "popupContainer"
      ? "popup"
      : "unknown";

  return { container, surface };
}

export function renderUI(container) {
  if (container && typeof window.createUI === "function" && !container.dataset.uiRendered) {
    container.innerHTML = window.createUI();
    container.dataset.uiRendered = "true";
  }
}

export async function openWindow() {
  await chrome.runtime.sendMessage({ type: "hh-open-window" });
  return true;
}

export async function openModal() {
  try {
    await chrome.runtime.sendMessage({ type: "hh-open-modal" });
    return true;
  } catch (err) {
    console.warn('[HH] openModal failed, falling back to window', err);
    await openWindow();
    return true;
  }
}

export async function openSidePanel() {
  try {
    const win = await chrome.windows.getCurrent();
    if (chrome.sidePanel?.open) {
      await chrome.sidePanel.open({ windowId: win.id });
      return true;
    }
  } catch (err) {
    console.warn('[HH] openSidePanel failed, falling back', err);
  }
  await openWindow();
  return true;
}

export async function routeFromPopupIfNeeded(preferred) {
  const isPopupSurface = !!document.getElementById("popupContainer");
  const pathname = (window.location && window.location.pathname) || "";
  const isToolbarPopup = pathname.endsWith("/popup.html");
  if (!isPopupSurface || !isToolbarPopup) return false;

  if (preferred === "popup") return false;

  if (preferred === "sidepanel") {
    await openSidePanel();
  } else if (preferred === "modal") {
    await openModal();
  } else if (preferred === "window") {
    await openWindow();
  }

  try {
    window.close();
  } catch (err) {
    console.warn('[HH] window close failed', err);
  }
  return true;
}
