(() => {
  const SETTINGS_KEY = "hh-settings";
  const MODEL_CACHE_KEY = "hh-model-cache";
  const MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  const DEFAULT_GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-001",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.5-flash-lite",
    "gemini-2.5-pro-preview-03-25",
    "gemini-2.5-flash-preview-05-20",
  ];

  const $ = (id) => document.getElementById(id);
  const activeProvider = $("activeProvider");
  const geminiApiKey = $("geminiApiKey");
  const geminiDefaultModel = $("geminiDefaultModel");
  const geminiApiVersion = $("geminiApiVersion");
  const refreshGeminiModelsBtn = $("refreshGeminiModels");
  const modelCatalogStatus = $("modelCatalogStatus");
  const saveBtn = $("saveBtn");
  const status = $("status");

  const defaultSettings = {
    activeProvider: "gemini",
    providers: {
      gemini: {
        apiKey: "",
        defaultModel: "gemini-2.5-flash",
        apiVersion: "v1",
      },
    },
  };

  const storageGet = (keys) =>
    new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => resolve(result));
    });

  const storageSet = (entries) =>
    new Promise((resolve) => {
      chrome.storage.local.set(entries, () => resolve());
    });

  const setModelCatalogStatus = (message, state = "info") => {
    if (!modelCatalogStatus) return;
    modelCatalogStatus.textContent = message || "";
    modelCatalogStatus.dataset.state = message ? state : "";
  };

  const setSettingsStatus = (message, state = "info") => {
    if (!status) return;
    status.textContent = message || "";
    status.dataset.state = message ? state : "";
  };

  const mapModelEntries = (models) => {
    if (!Array.isArray(models)) return [];
    return models
      .map((entry) => {
        if (!entry) return null;
        if (typeof entry === "string") {
          return { value: entry, label: entry };
        }
        const name = entry.name || entry.value;
        if (!name) return null;
        const labelParts = [];
        if (entry.displayName && entry.displayName !== name) {
          labelParts.push(entry.displayName);
        } else {
          labelParts.push(name);
        }
        if (entry.version && !labelParts[0].includes(entry.version)) {
          labelParts.push(`(${entry.version})`);
        }
        return {
          value: name,
          label: labelParts.join(" ").trim(),
        };
      })
      .filter(Boolean);
  };

  const renderGeminiModelOptions = (models, options = {}) => {
    if (!geminiDefaultModel) return;
    const {
      preserveSelection = true,
      requestedValue,
    } = options;

    const previousValue = preserveSelection ? geminiDefaultModel.value : "";
    const entries = mapModelEntries(models);

    geminiDefaultModel.innerHTML = "";

    if (!entries.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No models available";
      option.disabled = true;
      geminiDefaultModel.appendChild(option);
      geminiDefaultModel.value = "";
      geminiDefaultModel.dataset.requestedValue = "";
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const entry of entries) {
      const option = document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.label;
      fragment.appendChild(option);
    }
    geminiDefaultModel.appendChild(fragment);

    const requested = requestedValue ?? geminiDefaultModel.dataset.requestedValue;
    const selectionOrder = [requested, previousValue, entries[0]?.value].filter(Boolean);
    const target = selectionOrder.find((value) => entries.some((entry) => entry.value === value)) || entries[0].value;
    geminiDefaultModel.value = target;
    geminiDefaultModel.dataset.requestedValue = target;
  };

  const getCachedGeminiModels = async () => {
    const cache = await storageGet([MODEL_CACHE_KEY]);
    const entry = cache?.[MODEL_CACHE_KEY]?.providers?.gemini;
    if (!entry || !Array.isArray(entry.models)) {
      return null;
    }
    const fetchedAt = entry.fetchedAt || 0;
    if (Date.now() - fetchedAt > MODEL_CACHE_TTL_MS) {
      return null;
    }
    return entry;
  };

  const setCachedGeminiModels = async (models, meta = {}) => {
    const cache = {
      providers: {
        gemini: {
          models,
          fetchedAt: Date.now(),
          versions: meta.versions || [],
        },
      },
    };
    await storageSet({ [MODEL_CACHE_KEY]: cache });
  };

  let isSyncingCatalog = false;
  const syncGeminiModelOptions = async ({ forceRefresh = false } = {}) => {
    if (isSyncingCatalog) return;
    isSyncingCatalog = true;

    try {
      const apiKey = geminiApiKey?.value.trim();
      if (!apiKey) {
        renderGeminiModelOptions(DEFAULT_GEMINI_MODELS, { preserveSelection: false });
        setModelCatalogStatus("Enter an API key to fetch live models.");
        return;
      }

      const selectedVersion = geminiApiVersion?.value || "v1";
      const versions = Array.from(new Set([selectedVersion, "v1", "v1beta"]));

      let catalog = null;
      if (!forceRefresh) {
        catalog = await getCachedGeminiModels();
      }

      if (catalog) {
        renderGeminiModelOptions(catalog.models);
        const timestamp = new Date(catalog.fetchedAt || Date.now()).toLocaleTimeString();
        setModelCatalogStatus(`Loaded ${catalog.models.length} models (cached ${timestamp}).`, "info");
        return;
      }

      setModelCatalogStatus("Fetching model catalog…");
      if (refreshGeminiModelsBtn) refreshGeminiModelsBtn.disabled = true;
      if (geminiDefaultModel) geminiDefaultModel.disabled = true;

      const models = await window.listGeminiModels(apiKey, {
        versions,
        allowExperimental: true,
      });

      if (!models.length) {
        renderGeminiModelOptions(DEFAULT_GEMINI_MODELS, { preserveSelection: false });
        setModelCatalogStatus("No models returned. Using defaults.", "error");
        return;
      }

      await setCachedGeminiModels(models, { versions });
      renderGeminiModelOptions(models);
      const timestamp = new Date().toLocaleTimeString();
      setModelCatalogStatus(`Fetched ${models.length} models at ${timestamp}.`, "success");
    } catch (err) {
      console.error("Failed to sync Gemini models", err);
      renderGeminiModelOptions(DEFAULT_GEMINI_MODELS, { preserveSelection: false });
      setModelCatalogStatus(err?.message || "Failed to fetch models", "error");
    } finally {
      isSyncingCatalog = false;
      if (refreshGeminiModelsBtn) refreshGeminiModelsBtn.disabled = false;
      if (geminiDefaultModel) geminiDefaultModel.disabled = false;
    }
  };

  const loadSettings = async () => {
    const stored = await storageGet([SETTINGS_KEY]);
    const settings = stored?.[SETTINGS_KEY] || defaultSettings;
    try {
      activeProvider.value = settings.activeProvider || "gemini";
      const gemini = settings.providers?.gemini || {};
      geminiApiKey.value = gemini.apiKey || "";
      geminiApiVersion.value = gemini.apiVersion || "v1";
      const requestedModel = gemini.defaultModel || "";
      geminiDefaultModel.dataset.requestedValue = requestedModel;
      renderGeminiModelOptions(DEFAULT_GEMINI_MODELS, {
        preserveSelection: false,
        requestedValue: requestedModel,
      });
    } catch (err) {
      console.error("Failed to apply settings", err);
      setSettingsStatus("Failed to load settings", "error");
    }
    return settings;
  };

  const saveSettings = async () => {
    const payload = {
      activeProvider: activeProvider.value,
      providers: {
        gemini: {
          apiKey: geminiApiKey.value.trim(),
          defaultModel: geminiDefaultModel.value,
          apiVersion: geminiApiVersion.value,
        },
      },
    };

    try {
      await storageSet({ [SETTINGS_KEY]: payload });
      setSettingsStatus("Settings saved!", "success");
      setTimeout(() => setSettingsStatus(""), 1500);
      chrome.runtime.sendMessage({ type: "config-updated" });
    } catch (err) {
      console.error("Save failed", err);
      setSettingsStatus("Save failed", "error");
    }
  };

  const init = async () => {
    await loadSettings();
    await syncGeminiModelOptions();

    if (refreshGeminiModelsBtn) {
      refreshGeminiModelsBtn.addEventListener("click", () => syncGeminiModelOptions({ forceRefresh: true }));
    }

    if (geminiApiVersion) {
      geminiApiVersion.addEventListener("change", () => syncGeminiModelOptions());
    }

    if (geminiApiKey) {
      geminiApiKey.addEventListener("blur", () => syncGeminiModelOptions({ forceRefresh: true }));
    }

    if (geminiDefaultModel) {
      geminiDefaultModel.addEventListener("change", () => {
        geminiDefaultModel.dataset.requestedValue = geminiDefaultModel.value;
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", (event) => {
        event.preventDefault();
        saveSettings();
      });
    }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
