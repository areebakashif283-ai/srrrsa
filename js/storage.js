// LocalStorage-based settings & generation history
const Storage = (() => {
  const HISTORY_KEY = 'lumen_history_v1';
  const SETTINGS_KEY = 'lumen_settings_v1';

  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveSettings(patch) {
    const next = { ...getSettings(), ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  function getApiKey(provider) {
    const settings = getSettings();
    return settings.apiKeys ? settings.apiKeys[provider] : '';
  }

  function setApiKey(provider, key) {
    const settings = getSettings();
    const apiKeys = { ...(settings.apiKeys || {}), [provider]: key };
    saveSettings({ apiKeys });
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function addHistory(entry) {
    const items = getHistory();
    const record = {
      id: 'gen_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      createdAt: Date.now(),
      ...entry,
    };
    items.unshift(record);
    const trimmed = items.slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    return record;
  }

  function removeHistory(id) {
    const items = getHistory().filter((x) => x.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  return {
    getSettings,
    saveSettings,
    getApiKey,
    setApiKey,
    getHistory,
    addHistory,
    removeHistory,
    clearHistory,
  };
})();

window.Storage = Storage;
