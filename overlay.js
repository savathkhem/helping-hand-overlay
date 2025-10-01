(() => {
  if (window.__helpingHandOverlayActive) {
    chrome.runtime.sendMessage({ type: "hh-selection-error", error: "Selection already active" });
    return;
  }

  window.__helpingHandOverlayActive = true;

  const applyStyles = (element, styles) => {
    Object.assign(element.style, styles);
  };

  const applyButtonStyles = (button) => {
    const toggled = button.dataset.toggled === "true";
    const primary = button.dataset.primary === "true";
    const disabled = button.disabled;

    applyStyles(button, {
      border: "none",
      borderRadius: "22px",
      padding: "6px 14px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: disabled ? "not-allowed" : "pointer",
      background: primary || toggled ? "linear-gradient(135deg, #2563eb, #1d4ed8)" : "#e2e8f0",
      color: primary || toggled ? "#ffffff" : "#1e293b",
      opacity: disabled ? "0.45" : "1",
      boxShadow: primary || toggled ? "0 12px 26px -18px rgba(37, 99, 235, 0.9)" : "none",
      transition: "transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, color 0.12s ease",
    });
  };

  const setButtonToggled = (button, toggled) => {
    button.dataset.toggled = toggled ? "true" : "false";
    applyButtonStyles(button);
  };

  const setButtonDisabled = (button, disabled) => {
    button.disabled = disabled;
    applyButtonStyles(button);
  };

  const createButton = (label, options = {}) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hh-overlay-btn";
    button.textContent = label;

    if (options.action) {
      button.dataset.action = options.action;
    }
    if (options.role) {
      button.dataset.role = options.role;
    }
    if (options.value) {
      button.dataset.value = options.value;
    }
    if (options.primary) {
      button.dataset.primary = "true";
    }
    if (options.toggled) {
      button.dataset.toggled = "true";
    }

    setButtonDisabled(button, !!options.disabled);
    applyButtonStyles(button);
    return button;
  };

  const root = document.createElement("div");
  root.className = "hh-overlay-root";
  root.dataset.state = "idle";
  applyStyles(root, {
    position: "fixed",
    top: "0",
    right: "0",
    bottom: "0",
    left: "0",
    zIndex: "2147483646",
    fontFamily: '"Segoe UI", Arial, sans-serif',
    userSelect: "none",
    color: "#0f172a",
  });
  document.documentElement.appendChild(root);

  const surface = document.createElement("div");
  surface.className = "hh-overlay-surface";
  applyStyles(surface, {
    position: "absolute",
    top: "0",
    right: "0",
    bottom: "0",
    left: "0",
    background: "rgba(15, 23, 42, 0.55)",
    backdropFilter: "blur(1px)",
    pointerEvents: "auto",
    cursor: "crosshair",
    touchAction: "none",
  });
  root.appendChild(surface);

  const marquee = document.createElement("div");
  marquee.className = "hh-overlay-marquee";
  applyStyles(marquee, {
    position: "absolute",
    border: "2px solid rgba(96, 165, 250, 0.9)",
    background: "rgba(59, 130, 246, 0.18)",
    borderRadius: "8px",
    display: "none",
    pointerEvents: "none",
  });
  const marqueeLabel = document.createElement("div");
  marqueeLabel.className = "hh-overlay-marquee-label";
  applyStyles(marqueeLabel, {
    position: "absolute",
    top: "100%",
    left: "0",
    marginTop: "6px",
    padding: "4px 6px",
    borderRadius: "6px",
    background: "rgba(15, 23, 42, 0.85)",
    color: "#f8fafc",
    fontSize: "11px",
    whiteSpace: "nowrap",
  });
  marquee.appendChild(marqueeLabel);
  root.appendChild(marquee);

  const toolbar = document.createElement("div");
  toolbar.className = "hh-overlay-toolbar";
  applyStyles(toolbar, {
    position: "absolute",
    top: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 18px",
    background: "rgba(255, 255, 255, 0.97)",
    borderRadius: "999px",
    boxShadow: "0 16px 40px -24px rgba(15, 23, 42, 0.6)",
    pointerEvents: "auto",
    fontSize: "12px",
    color: "#0f172a",
  });
  root.appendChild(toolbar);

  const createGroup = () => {
    const div = document.createElement("div");
    div.className = "hh-overlay-group";
    applyStyles(div, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    });
    return div;
  };

  const createDivider = () => {
    const div = document.createElement("div");
    div.className = "hh-overlay-divider";
    applyStyles(div, {
      width: "1px",
      height: "24px",
      background: "rgba(148, 163, 184, 0.6)",
    });
    return div;
  };

  const mediaGroup = createGroup();
  const imageBtn = createButton("Image", { role: "media", value: "image", toggled: true });
  const videoBtn = createButton("Video", { role: "media", value: "video" });
  mediaGroup.append(imageBtn, videoBtn);

  const modeGroup = createGroup();
  const rectangleBtn = createButton("Rectangle", { role: "shape", value: "rectangle", toggled: true });
  const fullBtn = createButton("Full tab", { action: "full" });
  modeGroup.append(rectangleBtn, fullBtn);

  const controlGroup = createGroup();
  const cancelBtn = createButton("Cancel", { action: "cancel" });
  const confirmBtn = createButton("Confirm", { action: "confirm", primary: true, disabled: true });
  controlGroup.append(cancelBtn, confirmBtn);

  toolbar.append(mediaGroup, createDivider(), modeGroup, createDivider(), controlGroup);

  const hint = document.createElement("div");
  hint.className = "hh-overlay-hint";
  hint.textContent = "Drag to select | Enter to confirm | Esc to cancel";
  applyStyles(hint, {
    position: "absolute",
    bottom: "28px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 16px",
    borderRadius: "999px",
    background: "rgba(15, 23, 42, 0.65)",
    color: "#e2e8f0",
    fontSize: "12px",
    letterSpacing: "0.04em",
    pointerEvents: "none",
    textAlign: "center",
  });
  root.appendChild(hint);

  const MIN_SELECTION = 5;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let latestRect = null;
  let selectionRect = null;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const updateMarquee = (rect) => {
    if (!rect) {
      marquee.style.display = "none";
      marqueeLabel.textContent = "";
      return;
    }

    marquee.style.display = "block";
    marquee.style.left = `${rect.x}px`;
    marquee.style.top = `${rect.y}px`;
    marquee.style.width = `${rect.width}px`;
    marquee.style.height = `${rect.height}px`;
    marqueeLabel.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
  };

  const clearSelection = () => {
    selectionRect = null;
    latestRect = null;
    setButtonDisabled(confirmBtn, true);
    updateMarquee(null);
  };

  const finalizeSelection = (rect) => {
    if (!rect || rect.width < MIN_SELECTION || rect.height < MIN_SELECTION) {
      clearSelection();
      return;
    }

    selectionRect = {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };

    setButtonDisabled(confirmBtn, false);
  };

  const buildPayload = (rect) => ({
    selection: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
  });

  const cleanup = () => {
    window.__helpingHandOverlayActive = false;
    surface.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("mouseup", onMouseUp, true);
    window.removeEventListener("keydown", onKeyDown, true);
    toolbar.removeEventListener("click", onToolbarClick, true);
    requestAnimationFrame(() => root.remove());
  };

  const sendAndClose = (type, payload) => {
    if (payload) {
      chrome.runtime.sendMessage({ type, payload });
    } else {
      chrome.runtime.sendMessage({ type });
    }
    cleanup();
  };

  const onMouseDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    if (toolbar.contains(event.target)) {
      return;
    }

    isDragging = true;
    root.dataset.state = "dragging";
    setButtonDisabled(confirmBtn, true);

    startX = clamp(event.clientX, 0, window.innerWidth);
    startY = clamp(event.clientY, 0, window.innerHeight);
    latestRect = { x: startX, y: startY, width: 0, height: 0 };
    updateMarquee({ x: startX, y: startY, width: 1, height: 1 });

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mouseup", onMouseUp, true);

    event.preventDefault();
    event.stopPropagation();
  };

  const onMouseMove = (event) => {
    if (!isDragging) {
      return;
    }

    const currentX = clamp(event.clientX, 0, window.innerWidth);
    const currentY = clamp(event.clientY, 0, window.innerHeight);
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    latestRect = { x, y, width, height };
    updateMarquee({ x, y, width: Math.max(width, 1), height: Math.max(height, 1) });

    event.preventDefault();
  };

  const onMouseUp = (event) => {
    if (!isDragging || event.button !== 0) {
      return;
    }

    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("mouseup", onMouseUp, true);

    root.dataset.state = "idle";
    isDragging = false;
    finalizeSelection(latestRect);

    event.preventDefault();
  };

  const onToolbarClick = (event) => {
    const button = event.target.closest("button.hh-overlay-btn");
    if (!button) {
      return;
    }

    const action = button.dataset.action;
    const role = button.dataset.role;
    const value = button.dataset.value;

    if (role === "media") {
      if (value === "video") {
        sendAndClose("hh-video-start");
        return;
      }
      setButtonToggled(imageBtn, value === "image");
      setButtonToggled(videoBtn, value === "video");
      return;
    }
    if (role === "shape") {
      setButtonToggled(rectangleBtn, true);
      return;
    }

    if (action === "full") {
      const rect = {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
      sendAndClose("hh-selection-full", buildPayload(rect));
      return;
    }

    if (action === "cancel") {
      sendAndClose("hh-selection-cancel");
      return;
    }

    if (action === "confirm") {
      if (!selectionRect) {
        return;
      }
      sendAndClose("hh-selection-region", buildPayload(selectionRect));
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      sendAndClose("hh-selection-cancel");
      event.preventDefault();
      return;
    }

    if ((event.key === "Enter" || event.key === "Return") && selectionRect) {
      sendAndClose("hh-selection-region", buildPayload(selectionRect));
      event.preventDefault();
    }
  };

  surface.addEventListener("mousedown", onMouseDown, true);
  toolbar.addEventListener("click", onToolbarClick, true);
  window.addEventListener("keydown", onKeyDown, true);

  clearSelection();
})();


