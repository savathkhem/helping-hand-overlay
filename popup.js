document.addEventListener("DOMContentLoaded", async () => {
  const container =
    document.getElementById("popupContainer") ||
    document.getElementById("sidePanelContainer");
  const isSidePanel = container?.id === "sidePanelContainer";

  if (container && typeof window.createUI === "function" && !container.dataset.uiRendered) {
    container.innerHTML = window.createUI();
    container.dataset.uiRendered = "true";
  }

  const captureBtn = document.getElementById("captureBtn");
  const screenshotImg = document.getElementById("screenshotImg");
  const screenshotPlaceholder = document.getElementById("screenshotPlaceholder");
  const recordBtn = document.getElementById("recordBtn");
  const recordingSpinner = document.getElementById("recordingSpinner");
  const status = document.getElementById("status");
  const promptText = document.getElementById("promptText");
  const transcriptHistory = document.getElementById("transcriptHistory");
  const historyList = document.getElementById("historyList");
  const submitBtn = document.getElementById("submitBtn");
  const submitSpinner = document.getElementById("submitSpinner");
  const responseContainer = document.getElementById("responseContainer");
  const headerSettingsCog = document.getElementById("headerSettingsCog");
  const openPanelBtn = document.getElementById("openPanelBtn");

  if (isSidePanel && openPanelBtn) {
    openPanelBtn.style.display = "none";
  }

  const captureBtnDefaultLabel = captureBtn ? captureBtn.textContent : "Capture";
  const submitBtnDefaultLabel = submitBtn ? submitBtn.textContent : "Get Help";

  const HISTORY_LIMIT = 10;
  const PENDING_CAPTURE_KEY = "hh-pending-capture";
  let pendingCaptureId = null;
  let latestScreenshotDataUrl = "";
  let isSelecting = false;

  const storage = new window.CaptureStorage();
  let storageInitError = null;
  const storageReady = storage
    .init()
    .then(() => {
      console.log('[HH] storageReady resolved');
      return true;
    })
    .catch((err) => {
      storageInitError = err;
      console.error("Capture storage init failed", err);
      return null;
    });

  window.__hhDebug = {
    storage,
    storageReady,
    get storageInitError() {
      return storageInitError;
    },
    async dumpCaptures(limit = 10) {
      await storageReady;
      try {
        const captures = await storage.listRecentCaptures(limit);
        console.log('[HH] dumpCaptures', captures);
        return captures;
      } catch (err) {
        console.error('[HH] dumpCaptures failed', err);
        throw err;
      }
    },
  };

  const clearPendingCapture = () =>
    new Promise((resolve) => {
      chrome.storage.local.remove(PENDING_CAPTURE_KEY, () => {
        if (chrome.runtime.lastError) {
          console.warn('[HH] clearPendingCapture failed', chrome.runtime.lastError.message);
        }
        resolve();
      });
    });

  const consumePendingCapture = () =>
    new Promise((resolve) => {
      chrome.storage.local.get([PENDING_CAPTURE_KEY], async (result) => {
        if (chrome.runtime.lastError) {
          console.warn('[HH] consumePendingCapture failed', chrome.runtime.lastError.message);
          resolve();
          return;
        }

        const stored = result?.[PENDING_CAPTURE_KEY];
        if (!stored) {
          resolve();
          return;
        }

        console.log('[HH] consumePendingCapture', stored);

        try {
          if (stored.screenshotDataUrl) {
            await handleSelectionResult(stored);
          } else if (stored.error) {
            if (responseContainer) {
              responseContainer.textContent = 'Capture failed: ' + stored.error;
            }
          }
        } catch (err) {
          console.error('[HH] consumePendingCapture handler failed', err);
        } finally {
          await clearPendingCapture();
          resolve();
        }
      });
    });



  const SETTINGS_KEY = "hh-settings";
  let settingsCache = null;

  const loadSettings = () =>
    new Promise((resolve) => {
      try {
        chrome.storage.local.get([SETTINGS_KEY], (res) => {
          settingsCache = res?.[SETTINGS_KEY] || null;
          resolve(settingsCache);
        });
      } catch (e) {
        console.warn("Failed to load settings", e);
        resolve(null);
      }
    });

  const getActiveProviderSettings = () => {
    const active = settingsCache?.activeProvider || "gemini";
    const prov = settingsCache?.providers?.[active] || {};
    return { active, prov };
  };

  const renderHistory = (captures = []) => {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (!Array.isArray(captures) || captures.length === 0) {
      if (transcriptHistory) transcriptHistory.hidden = true;
      return;
    }

    if (transcriptHistory) transcriptHistory.hidden = false;

    captures.forEach((capture) => {
      const li = document.createElement("li");
      li.className = "history-item";
      if (capture.status === "error") li.classList.add("history-item-error");

      if (capture.thumbnailDataUrl) {
        const thumb = document.createElement("img");
        thumb.className = "history-thumb";
        thumb.src = capture.thumbnailDataUrl;
        thumb.alt = "Screenshot thumbnail";
        thumb.addEventListener("click", (event) => {
          event.stopPropagation();
          pendingCaptureId = null;
          setScreenshotState(capture.thumbnailDataUrl);
        });
        li.appendChild(thumb);
      }

      const textWrapper = document.createElement("div");
      textWrapper.className = "history-text";

      const promptDiv = document.createElement("div");
      promptDiv.className = "history-prompt";
      promptDiv.textContent = capture.prompt || "Untitled capture";
      textWrapper.appendChild(promptDiv);

      if (capture.response) {
        const responseDiv = document.createElement("div");
        responseDiv.className = "history-response";
        responseDiv.textContent = capture.response;
        textWrapper.appendChild(responseDiv);
      }

      const statusDiv = document.createElement("div");
      statusDiv.className = "history-status";
      const statusCopy =
        capture.status === "completed"
          ? "Response saved"
          : capture.status === "pending"
          ? "Awaiting response"
          : capture.status === "error"
          ? `Error: ${capture.error || "Request failed"}`
          : "Draft";
      statusDiv.textContent = statusCopy;
      textWrapper.appendChild(statusDiv);

      li.appendChild(textWrapper);

      li.addEventListener("click", () => {
        pendingCaptureId = capture.id;
        if (capture.thumbnailDataUrl) setScreenshotState(capture.thumbnailDataUrl);
        if (promptText && capture.prompt) promptText.value = capture.prompt;
        if (responseContainer && capture.response) responseContainer.textContent = capture.response;
      });

      historyList.appendChild(li);
    });
  };

  const recordDraftHistory = async (prompt) => {
    const trimmed = (prompt || "").trim();
    console.log('[HH] recordDraftHistory', { trimmed });
    if (!trimmed) return;

    await storageReady;
    if (storageInitError) return;

    const existingDraft = (await storage.listRecentCaptures()).find(
      (c) => c.status === "draft" && c.prompt === trimmed
    );

    const capture = await storage.upsertCapture({
      id: existingDraft?.id,
      prompt: trimmed,
      response: existingDraft?.response || "",
      thumbnailDataUrl: latestScreenshotDataUrl || existingDraft?.thumbnailDataUrl || "",
      status: "draft",
    });
    pendingCaptureId = capture.id;
    await loadHistory();
  };

  const markHistoryPending = async (prompt) => {
    const trimmed = (prompt || "").trim();
    console.log('[HH] markHistoryPending', { trimmed });
    if (!trimmed) return;

    await storageReady;
    if (storageInitError) {
      pendingCaptureId = null;
      return;
    }

    let thumb = "";
    try {
      if (latestScreenshotDataUrl) {
        thumb = await createThumbnail(latestScreenshotDataUrl);
      }
    } catch (e) {
      console.warn("Thumbnail generation failed", e);
    }

    const capture = await storage.upsertCapture({
      id: pendingCaptureId,
      prompt: trimmed,
      thumbnailDataUrl: thumb,
      status: "pending",
    });
    pendingCaptureId = capture.id;
    await loadHistory();
  };

  const completeHistoryEntry = async (response) => {
    console.log('[HH] completeHistoryEntry', { pendingCaptureId, response });
    if (!pendingCaptureId) return;

    await storageReady;
    if (storageInitError) {
      pendingCaptureId = null;
      return;
    }

    await storage.updateCapture(pendingCaptureId, {
      response,
      status: "completed",
      error: "",
    });
    pendingCaptureId = null;
    await loadHistory();
  };

  const failHistoryEntry = async (errorMessage) => {
    console.log('[HH] failHistoryEntry', { pendingCaptureId, errorMessage });
    if (!pendingCaptureId) return;

    await storageReady;
    if (storageInitError) {
      pendingCaptureId = null;
      return;
    }

    await storage.updateCapture(pendingCaptureId, {
      status: "error",
      error: errorMessage,
    });
    pendingCaptureId = null;
    await loadHistory();
  };

  const loadHistory = async () => {
    await storageReady;

    if (storageInitError) {
      renderHistory([]);
      return;
    }

    try {
      const captures = await storage.listRecentCaptures(HISTORY_LIMIT);
      console.log('[HH] loadHistory', { count: captures.length, captures });
      renderHistory(captures);
    } catch (error) {
      console.error("History load threw:", error);
      renderHistory([]);
    }
  };

  const setScreenshotState = (dataUrl) => {
    if (dataUrl && dataUrl.startsWith("data:image")) {
      latestScreenshotDataUrl = dataUrl;
      if (screenshotImg) {
        screenshotImg.src = dataUrl;
        screenshotImg.setAttribute("data-visible", "true");
      }
      if (screenshotPlaceholder) screenshotPlaceholder.hidden = true;
    } else {
      latestScreenshotDataUrl = "";
      if (screenshotImg) {
        screenshotImg.removeAttribute("src");
        screenshotImg.setAttribute("data-visible", "false");
      }
      if (screenshotPlaceholder) screenshotPlaceholder.hidden = false;
    }
  };

  const resetCaptureButton = () => {
    if (!captureBtn) return;
    captureBtn.disabled = false;
    captureBtn.textContent = captureBtnDefaultLabel;
    isSelecting = false;
  };

  const toggleRecordingSpinner = (show) => {
    if (recordingSpinner) recordingSpinner.hidden = !show;
  };

  const toggleSubmitSpinner = (show) => {
    if (submitSpinner) submitSpinner.hidden = !show;
  };

  const cropScreenshot = (dataUrl, selection) =>
    new Promise((resolve, reject) => {
      if (!selection) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const scaleX = img.naturalWidth / selection.viewportWidth;
          const scaleY = img.naturalHeight / selection.viewportHeight;

          const cropWidth = Math.max(1, Math.round(selection.width * scaleX));
          const cropHeight = Math.max(1, Math.round(selection.height * scaleY));
          const sourceX = Math.max(0, Math.round(selection.x * scaleX));
          const sourceY = Math.max(0, Math.round(selection.y * scaleY));

          const canvas = document.createElement("canvas");
          canvas.width = cropWidth;
          canvas.height = cropHeight;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(
            img,
            sourceX,
            sourceY,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
          );

          resolve(canvas.toDataURL("image/png"));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error("Failed to load screenshot for cropping."));
      img.src = dataUrl;
    });

  const handleSelectionResult = async (payload) => {
    resetCaptureButton();

    await storageReady;
    const storageUnavailable = !!storageInitError;
    console.log('[HH] handleSelectionResult', { hasScreenshot: !!(payload && payload.screenshotDataUrl), storageUnavailable, payload });

    if (!payload || !payload.screenshotDataUrl) {
      if (responseContainer) responseContainer.textContent = "Capture failed: No screenshot returned.";
      await clearPendingCapture();
      return;
    }

    try {
      if (captureBtn) {
        captureBtn.disabled = true;
        captureBtn.textContent = "Processing capture...";
      }

      const croppedDataUrl =
        payload.mode === "region"
          ? await cropScreenshot(payload.screenshotDataUrl, payload.selection)
          : payload.screenshotDataUrl;

      setScreenshotState(croppedDataUrl);
      if (!storageUnavailable) {
        try {
          const thumb = await createThumbnail(croppedDataUrl);
          const capture = await storage.upsertCapture({
            id: pendingCaptureId || undefined,
            prompt: promptText.value || "",
            thumbnailDataUrl: thumb,
            status: "draft",
            selection: payload.selection,
            mode: payload.mode,
          });
          pendingCaptureId = capture.id;
          await loadHistory();
        } catch (e) {
          console.warn("Thumbnail/capture creation failed after selection", e);
        }
      } else {
        pendingCaptureId = null;
      }
      if (responseContainer) responseContainer.textContent = "Screenshot ready. Provide your prompt and click Get Help.";
    } catch (error) {
      console.error("Cropping failed:", error);
      if (responseContainer) responseContainer.textContent = "Capture failed while cropping the selected area.";
    } finally {
      await clearPendingCapture();
      resetCaptureButton();
    }
  };

  chrome.runtime.onMessage.addListener((message) => {
    console.log('[HH] runtime message', message);
    if (!message || !message.type) return;
    switch (message.type) {
      case "hh-selection-result":
        handleSelectionResult(message.payload);
        break;
      case "hh-selection-cancelled":
        if (responseContainer) responseContainer.textContent = "Capture cancelled.";
        clearPendingCapture();
        resetCaptureButton();
        break;
      case "hh-selection-error":
        if (responseContainer)
          responseContainer.textContent = `Capture failed: ${message.error || "Unknown error"}`;
        clearPendingCapture();
        resetCaptureButton();
        break;
      default:
        break;
    }
  });

  const bootstrap = async () => {
    await storageReady;
    console.log('[HH] bootstrap', { storageInitError });
    await loadHistory();
    await loadSettings();
    await consumePendingCapture();
    setScreenshotState("");
  };

  bootstrap().catch((err) => {
    console.error("Popup bootstrap failed", err);
  });

  // --- Screenshot Functionality ---
  if (captureBtn) {
    captureBtn.addEventListener('click', () => {
      console.log('[HH] captureBtn click', { isSelecting });
      if (isSelecting) return;

      isSelecting = true;
      captureBtn.disabled = true;
      captureBtn.textContent = "Launching overlay...";
      if (responseContainer) responseContainer.textContent = "Select an area in the page to capture.";

      chrome.runtime.sendMessage({ type: "hh-start-selection" });
      captureBtn.textContent = "Waiting for selection...";
    });
  }

  // --- Voice-to-Text Functionality ---
  const recognition = window.createSpeechRecognition({
    onStart: () => {
      if (status) status.textContent = "Listening... Click to stop.";
      recordBtn.disabled = false;
      recordBtn.textContent = "Stop Recording";
      toggleRecordingSpinner(true);
      if (promptText) promptText.value = "";
    },
    onResult: (displayText, finalTranscript, isFinal) => {
      if (displayText && promptText) promptText.value = displayText;
    },
    onError: (error) => {
      const errorMessages = {
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "No microphone detected. Check your device.",
        "not-allowed": "Microphone access denied. Enable it in browser settings.",
        "service-not-allowed": "Speech recognition service not allowed on this device.",
        network: "Network error. Check your connection and try again.",
      };

      if (status) status.textContent = errorMessages[error] || `Error: ${error}`;
      recordBtn.textContent = "Start Recording";
      recordBtn.disabled = false;
      toggleRecordingSpinner(false);
    },
    onEnd: (finalTranscript) => {
      toggleRecordingSpinner(false);

      const trimmed = finalTranscript.trim();
      if (!trimmed && !(status?.textContent || "").startsWith("Error")) {
        if (status) status.textContent = "No speech captured. Click to record again.";
      } else if (trimmed) {
        if (promptText) promptText.value = trimmed;
        if (status) status.textContent = "Recording finished. Feel free to edit the text.";
        recordDraftHistory(trimmed);
      }

      recordBtn.disabled = false;
      recordBtn.textContent = "Start Recording";
    },
  });

  if (recognition) {
    recordBtn.addEventListener("click", () => {
      if (recognition.isRecording()) {
        recognition.stop();
        return;
      }
      recognition.start();
    });
  } else if (recordBtn) {
    recordBtn.disabled = true;
    if (status) status.textContent = "Sorry, your browser doesn't support speech recognition.";
  }

  // --- Submit to AI Functionality ---
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const screenshotDataUrl = (screenshotImg && screenshotImg.src) || "";
      const userPrompt = (promptText && promptText.value) || "";

      if (!screenshotDataUrl.startsWith("data:image")) {
        if (responseContainer) responseContainer.textContent = "Please capture a screenshot first.";
        return;
      }

      if (!userPrompt.trim()) {
        if (responseContainer) responseContainer.textContent = "Please provide a question via voice or text.";
        return;
      }

      const { active: activeProvider, prov } = getActiveProviderSettings();
      const effectiveApiKey =
        (prov && prov.apiKey) ||
        (typeof GEMINI_API_KEY !== "undefined" ? GEMINI_API_KEY : "");
      if (!effectiveApiKey || String(effectiveApiKey).includes("YOUR_")) {
        if (responseContainer)
          responseContainer.textContent =
            "Missing Gemini API key. Copy config.sample.js to config.js and set GEMINI_API_KEY.";
        return;
      }

      await markHistoryPending(userPrompt);

      submitBtn.disabled = true;
      submitBtn.textContent = "Thinking...";
      toggleSubmitSpinner(true);
      if (responseContainer) responseContainer.textContent = "Sending request to AI...";

      try {
        const base64 = screenshotDataUrl.split(",")[1];
        const requestBody = {
          contents: [
            {
              role: "user",
              parts: [
                { text: userPrompt },
                { inline_data: { mime_type: "image/png", data: base64 } },
              ],
            },
          ],
        };

        const pickModel = () => {
          if (prov?.defaultModel) return prov.defaultModel;
          if (typeof GEMINI_MODEL !== "undefined" && GEMINI_MODEL) return GEMINI_MODEL;
          return "gemini-1.5-flash";
        };

        const pickVersion = () => {
          if (prov?.apiVersion) return prov.apiVersion;
          if (typeof GEMINI_API_VERSION !== "undefined" && GEMINI_API_VERSION) return GEMINI_API_VERSION;
          return "v1";
        };

        const model = pickModel();
        const version = pickVersion();

        await storage.updateCapture(pendingCaptureId, { provider: `${activeProvider}:${model}` });

        const resolvedOutput = await window.callGeminiApi(effectiveApiKey, model, version, requestBody);

        if (responseContainer) responseContainer.textContent = resolvedOutput;
        await completeHistoryEntry(resolvedOutput);
      } catch (err) {
        console.error("Gemini request failed:", err);
        if (responseContainer) responseContainer.textContent = `Request failed: ${err.message}`;
        await failHistoryEntry(err.message || "Request failed");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtnDefaultLabel;
        toggleSubmitSpinner(false);
      }
    });
  }

  headerSettingsCog?.addEventListener("click", () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (e) {
      console.error("Failed to open settings", e);
    }
  });

  if (!isSidePanel && openPanelBtn) {
    openPanelBtn.addEventListener("click", async () => {
      try {
        const win = await chrome.windows.getCurrent();
        await chrome.sidePanel.open({ windowId: win.id });
        window.close();
      } catch (e) {
        console.error("Failed to open side panel", e);
      }
    });
  }

  async function createThumbnail(dataUrl, targetWidth = 200, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = targetWidth / img.naturalWidth;
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const thumb = canvas.toDataURL("image/jpeg", quality);
          resolve(thumb);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for thumbnail"));
      img.src = dataUrl;
    });
  }
});

