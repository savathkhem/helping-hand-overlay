(() => {
  const STORAGE_KEY = 'hh-settings';

  const $ = (id) => document.getElementById(id);
  const activeProvider = $('activeProvider');
  const geminiApiKey = $('geminiApiKey');
  const geminiDefaultModel = $('geminiDefaultModel');
  const geminiApiVersion = $('geminiApiVersion');
  const saveBtn = $('saveBtn');
  const status = $('status');

  const defaultSettings = {
    activeProvider: 'gemini',
    providers: {
      gemini: {
        apiKey: '',
        defaultModel: 'gemini-2.5-flash',
        apiVersion: 'v1',
      },
    },
  };

  function loadSettings() {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const s = result?.[STORAGE_KEY] || defaultSettings;
      try {
        activeProvider.value = s.activeProvider || 'gemini';
        const g = s.providers?.gemini || {};
        geminiApiKey.value = g.apiKey || '';
        geminiDefaultModel.value = g.defaultModel || 'gemini-2.5-flash';
        geminiApiVersion.value = g.apiVersion || 'v1';
        status.textContent = '';
      } catch (e) {
        console.error('Failed to apply settings', e);
        status.textContent = 'Failed to load settings';
      }
    });
  }

  function saveSettings() {
    const s = {
      activeProvider: activeProvider.value,
      providers: {
        gemini: {
          apiKey: geminiApiKey.value.trim(),
          defaultModel: geminiDefaultModel.value,
          apiVersion: geminiApiVersion.value,
        },
      },
    };

    chrome.storage.local.set({ [STORAGE_KEY]: s }, () => {
      if (chrome.runtime.lastError) {
        console.error('Save failed:', chrome.runtime.lastError.message);
        status.textContent = 'Save failed';
        return;
        }
      status.textContent = 'Settings saved!';
      setTimeout(() => (status.textContent = ''), 1500);
      chrome.runtime.sendMessage({ type: 'config-updated' });
    });
  }

  document.addEventListener('DOMContentLoaded', loadSettings);
  saveBtn.addEventListener('click', saveSettings);
})();

