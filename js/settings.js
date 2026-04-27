// Settings page logic
(function () {
  const settings = Storage.getSettings();
  const providerEl = document.getElementById('active-provider');
  const proxyEl = document.getElementById('proxy-url');
  // Providers that store an API key. 'devin-builtin' is included in the
  // dropdown but has no key field and isn't iterated here.
  const providers = ['huggingface', 'replicate', 'stability', 'runway', 'pika', 'luma'];

  providerEl.value = settings.activeProvider || 'devin-builtin';
  proxyEl.value = settings.proxyUrl || '';

  providers.forEach((p) => {
    const input = document.getElementById(`key-${p}`);
    const stored = Storage.getApiKey(p);
    if (stored) input.value = stored;
  });

  providerEl.addEventListener('change', () => {
    Storage.saveSettings({ activeProvider: providerEl.value });
    App.toast(`Active provider: ${providerEl.options[providerEl.selectedIndex].text}`, 'success');
  });

  document.querySelectorAll('[data-save]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.save;
      if (target === 'proxy') {
        Storage.saveSettings({ proxyUrl: proxyEl.value.trim() });
        App.toast('Proxy URL saved.', 'success');
      } else {
        const value = document.getElementById(`key-${target}`).value.trim();
        if (!value) {
          App.toast('Enter a key first.', 'error');
          return;
        }
        Storage.setApiKey(target, value);
        App.toast(`${target} key saved.`, 'success');
      }
    });
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('This will clear ALL keys and generation history from this browser. Continue?')) return;
    localStorage.removeItem('lumen_history_v1');
    localStorage.removeItem('lumen_settings_v1');
    providers.forEach((p) => {
      const input = document.getElementById(`key-${p}`);
      if (input) input.value = '';
    });
    proxyEl.value = '';
    providerEl.value = 'devin-builtin';
    App.toast('Lumen Studio reset.', 'info');
  });
})();
