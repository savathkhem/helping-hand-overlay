document.addEventListener("DOMContentLoaded", async () => {
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

  const captureBtnDefaultLabel = captureBtn ? captureBtn.textContent : "Capture";
  const submitBtnDefaultLabel = submitBtn ? submitBtn.textContent : "Get Help";

  const HISTORY_STORAGE_KEY = "hh-history";
  const HISTORY_LIMIT = 5;
  let historyEntries = [];
  let pendingHistoryId = null;
  let latestScreenshotDataUrl = "";
  let isSelecting = false;

  // Settings cache (loaded from chrome.storage.local)
  const SETTINGS_KEY = "hh-settings";
  let settingsCache = null;

  // FIXED: properly close callbacks/parens
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

  const saveHistory = () =>
    new Promise((resolve) => {
      try {
        chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: historyEntries }, () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to save history:", chrome.runtime.lastError.message);
          }
          resolve();
        });
      } catch (error) {
        console.error("History save threw:", error);
        resolve();
      }
    });

  const renderHistory = () => {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (!Array.isArray(historyEntries) || historyEntries.length === 0) {
      if (transcriptHistory) transcriptHistory.hidden = true;
      return;
    }

    if (transcriptHistory) transcriptHistory.hidden = false;

    historyEntries.forEach((entry) => {
      const li = document.createElement("li");
      li.className = "history-item";
      if (entry.status === "error") li.classList.add("history-item-error");

      if (entry.thumbnailDataUrl) {
        const thumb = document.createElement("img");
        thumb.className = "history-thumb";
        thumb.src = entry.thumbnailDataUrl;
        thumb.alt = "Screenshot thumbnail";
        thumb.addEventListener("click", (event) => {
          event.stopPropagation();
          pendingHistoryId = null;
          setScreenshotState(entry.thumbnailDataUrl);
        });
        li.appendChild(thumb);
      }

      const textWrapper = document.createElement("div");
      textWrapper.className = "history-text";

      const promptDiv = document.createElement("div");
      promptDiv.className = "history-prompt";
      promptDiv.textContent = entry.prompt || "Untitled prompt";
      textWrapper.appendChild(promptDiv);

      if (entry.response) {
        const responseDiv = document.createElement("div");
        responseDiv.className = "history-response";
        responseDiv.textContent = entry.response;
        textWrapper.appendChild(responseDiv);
      }

      const statusDiv = document.createElement("div");
      statusDiv.className = "history-status";
      const statusCopy =
        entry.status === "completed"
          ? "Response saved"
          : entry.status === "pending"
          ? "Awaiting response"
          : entry.status === "error"
          ? `Error: ${entry.error || "Request failed"}`
          : "Draft";
      statusDiv.textContent = statusCopy;
      textWrapper.appendChild(statusDiv);

      li.appendChild(textWrapper);

      li.addEventListener("click", () => {
        pendingHistoryId = null;
        if (entry.thumbnailDataUrl) setScreenshotState(entry.thumbnailDataUrl);
        if (promptText && entry.prompt) promptText.value = entry.prompt;
        if (responseContainer && entry.response) responseContainer.textContent = entry.response;
      });

      historyList.appendChild(li);
    });
  };

  const upsertHistoryEntry = (changes = {}) => {
    let targetId = changes.id || Date.now();
    let idx = historyEntries.findIndex((entry) => entry.id === targetId);
    let entry;

    if (idx === -1) {
      entry = {
        id: targetId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        prompt: changes.prompt || "",
        response: changes.response || "",
        thumbnailDataUrl: changes.thumbnailDataUrl || "",
        status: changes.status || "draft",
        error: changes.error || "",
      };
      historyEntries.unshift(entry);
    } else {
      entry = historyEntries[idx];
      if (changes.prompt !== undefined) entry.prompt = changes.prompt;
      if (changes.response !== undefined) entry.response = changes.response;
      if (changes.thumbnailDataUrl !== undefined) entry.thumbnailDataUrl = changes.thumbnailDataUrl;
      if (changes.status !== undefined) entry.status = changes.status;
      if (changes.error !== undefined) entry.error = changes.error;
      entry.updatedAt = Date.now();
      historyEntries.splice(idx, 1);
      historyEntries.unshift(entry);
    }

    if (historyEntries.length > HISTORY_LIMIT) historyEntries.length = HISTORY_LIMIT;

    saveHistory();
    renderHistory();

    return entry.id;
  };

  const recordDraftHistory = (prompt) => {
    const trimmed = (prompt || "").trim();
    if (!trimmed) return;

    const existingDraft = historyEntries.find(
      (entry) => entry.status === "draft" && entry.prompt === trimmed
    );

    pendingHistoryId = upsertHistoryEntry({
      id: existingDraft ? existingDraft.id : undefined,
      prompt: trimmed,
      response: existingDraft?.response || "",
      thumbnailDataUrl: latestScreenshotDataUrl || existingDraft?.thumbnailDataUrl || "",
      status: existingDraft?.status || "draft",
      error: "",
    });
  };

  const markHistoryPending = async (prompt) => {
    const trimmed = (prompt || "").trim();
    if (!trimmed) return;

    let targetId = pendingHistoryId;
    if (!targetId) {
      const existing = historyEntries.find(
        (entry) => entry.prompt === trimmed && entry.status !== "completed"
      );
      if (existing) targetId = existing.id;
    }

    let thumb = "";
    try {
      if (latestScreenshotDataUrl) {
        thumb = await createThumbnail(latestScreenshotDataUrl);
      }
    } catch (e) {
      console.warn("Thumbnail generation failed", e);
    }

    pendingHistoryId = upsertHistoryEntry({
      id: targetId,
      prompt: trimmed,
      thumbnailDataUrl: thumb,
      status: "pending",
      error: "",
    });
  };

  const completeHistoryEntry = (response) => {
    if (!pendingHistoryId) return;
    upsertHistoryEntry({
      id: pendingHistoryId,
      response,
      status: "completed",
      error: "",
    });
    pendingHistoryId = null;
  };

  const failHistoryEntry = (errorMessage) => {
    if (!pendingHistoryId) return;
    upsertHistoryEntry({
      id: pendingHistoryId,
      status: "error",
      error: errorMessage,
    });
    pendingHistoryId = null;
  };

  const loadHistory = () => {
    try {
      chrome.storage.local.get([HISTORY_STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to load history:", chrome.runtime.lastError.message);
          historyEntries = [];
          renderHistory();
          return;
        }

        const stored = result?.[HISTORY_STORAGE_KEY];
        historyEntries = Array.isArray(stored) ? stored.slice(0, HISTORY_LIMIT) : [];
        renderHistory();
      });
    } catch (error) {
      console.error("History load threw:", error);
      historyEntries = [];
      renderHistory();
    }
  };

  // FIXED: remove stray fragment; make toggling safe
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

    if (!payload || !payload.screenshotDataUrl) {
      if (responseContainer) responseContainer.textContent = "Capture failed: No screenshot returned.";
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
      try {
        const thumb = await createThumbnail(croppedDataUrl);
        const firstPrompt = historyEntries[0]?.prompt || "";
        const firstStatus = historyEntries[0]?.status || "draft";
        pendingHistoryId = upsertHistoryEntry({
          id: pendingHistoryId || undefined,
          prompt: firstPrompt,
          thumbnailDataUrl: thumb,
          status: firstStatus,
          error: "",
        });
      } catch (e) {
        console.warn("Thumbnail creation failed after capture", e);
      }
      if (responseContainer) responseContainer.textContent = "Screenshot ready. Provide your prompt and click Get Help.";
    } catch (error) {
      console.error("Cropping failed:", error);
      if (responseContainer) responseContainer.textContent = "Capture failed while cropping the selected area.";
    } finally {
      resetCaptureButton();
    }
  };

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    switch (message.type) {
      case "hh-selection-result":
        handleSelectionResult(message.payload);
        break;
      case "hh-selection-cancelled":
        if (responseContainer) responseContainer.textContent = "Capture cancelled.";
        resetCaptureButton();
        break;
      case "hh-selection-error":
        if (responseContainer)
          responseContainer.textContent = `Capture failed: ${message.error || "Unknown error"}`;
        resetCaptureButton();
        break;
      default:
        break;
    }
  });

  loadHistory();
  await loadSettings();
  setScreenshotState("");

  // --- Screenshot Functionality ---
  if (captureBtn) {
    captureBtn.addEventListener("click", () => {
      if (isSelecting) return;

      isSelecting = true;
      captureBtn.disabled = true;
      captureBtn.textContent = "Launching overlay...";
      if (responseContainer) responseContainer.textContent = "Select an area in the page to capture.";

      // Fire-and-forget: background will report any errors via hh-selection-error
      chrome.runtime.sendMessage({ type: "hh-start-selection" });
      captureBtn.textContent = "Waiting for selection...";
    });
  }

  // --- Voice-to-Text Functionality ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition;
  let mediaStream = null;

  const stopMicrophone = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
  };

  if (SpeechRecognition && recordBtn) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let isRecording = false;
    let finalTranscript = "";

    const startListening = async () => {
      if (isRecording) return;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (status) status.textContent = "Microphone API unavailable in this browser.";
        return;
      }

      recordBtn.disabled = true;
      recordBtn.textContent = "Starting...";
      toggleRecordingSpinner(true);
      if (status) status.textContent = "Requesting microphone permission...";

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.error("Microphone access denied:", err);
        if (status) status.textContent = "Microphone access denied. Enable it in browser settings.";
        recordBtn.disabled = false;
        recordBtn.textContent = "Start Recording";
        toggleRecordingSpinner(false);
        return;
      }

      try {
        recognition.start();
      } catch (err) {
        console.error("Speech recognition start error:", err);
        if (status) status.textContent = "Unable to start speech recognition. Please try again.";
        recordBtn.disabled = false;
        recordBtn.textContent = "Start Recording";
        toggleRecordingSpinner(false);
        stopMicrophone();
      }
    };

    recognition.onstart = () => {
      isRecording = true;
      if (status) status.textContent = "Listening... Click to stop.";
      recordBtn.disabled = false;
      recordBtn.textContent = "Stop Recording";
      toggleRecordingSpinner(true);
      if (promptText) promptText.value = "";
      finalTranscript = "";
    };

    recognition.onresult = (event) => {
      const finalPhrases = [];
      const interimPhrases = [];

      for (const result of event.results) {
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        if (result.isFinal) finalPhrases.push(transcript);
        else interimPhrases.push(transcript);
      }

      finalTranscript = finalPhrases.join(" ");
      const displayText = [finalTranscript, interimPhrases.join(" ")]
        .filter(Boolean)
        .join(" ");

      if (displayText && promptText) promptText.value = displayText;
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;

      console.error("Speech recognition error:", event.error);

      const errorMessages = {
        "no-speech": "No speech detected. Please try again.",
        "audio-capture": "No microphone detected. Check your device.",
        "not-allowed": "Microphone access denied. Enable it in browser settings.",
        "service-not-allowed": "Speech recognition service not allowed on this device.",
        network: "Network error. Check your connection and try again.",
      };

      if (status) status.textContent = errorMessages[event.error] || `Error: ${event.error}`;
      recordBtn.textContent = "Start Recording";
      recordBtn.disabled = false;
      isRecording = false;
      toggleRecordingSpinner(false);
      stopMicrophone();
    };

    recognition.onend = () => {
      stopMicrophone();
      toggleRecordingSpinner(false);

      const trimmed = finalTranscript.trim();
      if (!trimmed && !(status?.textContent || "").startsWith("Error")) {
        if (status) status.textContent = "No speech captured. Click to record again.";
      } else if (trimmed) {
        if (promptText) promptText.value = trimmed;
        if (status) status.textContent = "Recording finished. Feel free to edit the text.";
        recordDraftHistory(trimmed);
      }

      isRecording = false;
      recordBtn.disabled = false;
      recordBtn.textContent = "Start Recording";
    };

    recordBtn.addEventListener("click", () => {
      if (isRecording) {
        recognition.stop();
        return;
      }
      startListening();
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

      const { prov } = getActiveProviderSettings();
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
          return "gemini-1.5-flash"; // current, vision-capable
        };

        const pickVersion = () => {
          if (prov?.apiVersion) return prov.apiVersion;
          if (typeof GEMINI_API_VERSION !== "undefined" && GEMINI_API_VERSION) return GEMINI_API_VERSION;
          return "v1";
        };

        const baseModel = pickModel().trim();
        const baseVersion = pickVersion().trim();
        const versionsToTry =
          baseVersion === "v1"
            ? ["v1", "v1beta"]
            : baseVersion === "v1beta"
            ? ["v1beta", "v1"]
            : [baseVersion, "v1", "v1beta"];

        const combos = [];
        const seenCombos = new Set();
        const registerCombo = (model, apiVersion) => {
          const cleanModel = (model || "").trim();
          const cleanVersion = (apiVersion || "").trim();
          if (!cleanModel || !cleanVersion) return;
          const key = `${cleanModel}|${cleanVersion}`;
          if (!seenCombos.has(key)) {
            seenCombos.add(key);
            combos.push({ model: cleanModel, apiVersion: cleanVersion });
          }
        };

        const baseNoLatest = baseModel.replace(/-latest$/, "");
        const altVersions = versionsToTry.filter((ver) => ver !== baseVersion);

        registerCombo(baseModel, baseVersion);
        registerCombo(baseNoLatest, baseVersion);
        if (!baseNoLatest.endsWith("-001")) {
          registerCombo(`${baseNoLatest}-001`, baseVersion);
        }
        if (!baseModel.endsWith("-latest")) {
          registerCombo(`${baseNoLatest}-latest`, baseVersion);
        }

        altVersions.forEach((ver) => {
          registerCombo(baseModel, ver);
          registerCombo(baseNoLatest, ver);
          if (!baseNoLatest.endsWith("-001")) registerCombo(`${baseNoLatest}-001`, ver);
          if (!baseModel.endsWith("-latest")) registerCombo(`${baseNoLatest}-latest`, ver);
        });

        // Keep a couple legacy names but prioritize current ones first
        const fallbackModels = [
          "gemini-1.5-flash",
          "gemini-1.5-flash-001",
          "gemini-1.5-flash-latest",
          "gemini-1.5-pro",
          "gemini-1.5-pro-001",
          "gemini-1.5-pro-latest",
          "gemini-1.0-pro-vision", // legacy – try last
          "gemini-pro-vision",     // legacy – try last
          "gemini-1.0-pro",
          "gemini-pro",
        ];

        versionsToTry.forEach((ver) => {
          fallbackModels.forEach((modelName) => registerCombo(modelName, ver));
        });

        const callOnce = async (modelName, apiVersionName) => {
          const endpoint = `https://generativelanguage.googleapis.com/${apiVersionName}/models/${modelName}:generateContent?key=${encodeURIComponent(
            effectiveApiKey
          )}`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });
          const text = await res.text();
          return { res, text };
        };

        const triedCombos = [];
        let last404Body = "";
        let finalResponseText = "";

        for (const combo of combos) {
          const { res, text } = await callOnce(combo.model, combo.apiVersion);
          triedCombos.push(`${combo.apiVersion}/models/${combo.model}`);

          if (res.ok) {
            finalResponseText = text;
            break;
          }

          if (res.status === 404) {
            last404Body = text;
            continue;
          }

          let serverMsg = text;
          try {
            serverMsg = JSON.parse(text)?.error?.message || text;
          } catch {
            serverMsg = text;
          }
          throw new Error(`HTTP ${res.status}: ${serverMsg}`);
        }

        if (!finalResponseText) {
          // FIXED: use effectiveApiKey here, not GEMINI_API_KEY
          const listModels = async (versions) => {
            const discovered = new Set();
            for (const ver of versions) {
              const endpoint = `https://generativelanguage.googleapis.com/${ver}/models?key=${encodeURIComponent(
                effectiveApiKey
              )}`;
              try {
                const resp = await fetch(endpoint);
                if (!resp.ok) {
                  console.warn(`ListModels ${ver} returned ${resp.status}`);
                  continue;
                }
                const payload = await resp.json();
                const models = Array.isArray(payload.models) ? payload.models : [];
                for (const entry of models) {
                  if (!entry) continue;
                  const methods = Array.isArray(entry.supportedGenerationMethods)
                    ? entry.supportedGenerationMethods
                    : [];
                  if (methods.length && !methods.includes("generateContent")) continue;
                  const name =
                    typeof entry.name === "string"
                      ? entry.name.replace(/^models\//, "")
                      : "";
                  if (name) discovered.add(name);
                }
              } catch (listErr) {
                console.warn("Failed to list models for version", ver, listErr);
              }
            }
            return Array.from(discovered);
          };

          const availableModels = await listModels(versionsToTry);
          let suggestion = "";
          if (availableModels.length) {
            const sample = availableModels.slice(0, 10);
            suggestion = `\nAvailable models for your API key:\n- ${sample.join(
              "\n- "
            )}\nSet GEMINI_MODEL in config.js to one of these values and reload the extension.`;
          } else if (last404Body) {
            const trimmed = last404Body.length > 240 ? `${last404Body.slice(0, 240)}...` : last404Body;
            suggestion = `\nLast 404 response body:\n${trimmed}`;
          }

          throw new Error(
            `No supported Gemini model responded. Tried:\n- ${triedCombos.join(
              "\n- "
            )}${suggestion}`
          );
        }

        let output = "";
        try {
          const data = JSON.parse(finalResponseText);
          const candidate = data.candidates?.[0];
          if (candidate?.content?.parts?.length) {
            output = candidate.content.parts
              .map((p) => (typeof p.text === "string" ? p.text : ""))
              .filter(Boolean)
              .join("\n")
              .trim();
          }
        } catch (parseErr) {
          console.warn("Non-JSON response received", parseErr);
          output = finalResponseText;
        }

        const resolvedOutput = output || "No response text returned.";
        if (responseContainer) responseContainer.textContent = resolvedOutput;
        completeHistoryEntry(resolvedOutput);
      } catch (err) {
        console.error("Gemini request failed:", err);
        if (responseContainer) responseContainer.textContent = `Request failed: ${err.message}`;
        failHistoryEntry(err.message || "Request failed");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtnDefaultLabel;
        toggleSubmitSpinner(false);
      }
    });
  }

  // Header settings (gear)
  headerSettingsCog?.addEventListener("click", () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (e) {
      console.error("Failed to open settings", e);
    }
  });

  // Open side panel from popup
  openPanelBtn?.addEventListener("click", async () => {
    try {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close();
    } catch (e) {
      console.error("Failed to open side panel", e);
    }
  });

  // Thumbnail creation utility
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
