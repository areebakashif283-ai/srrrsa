// Shared utilities, navigation, toasts, scroll animations
const App = (() => {
  const toastStack = () => {
    let el = document.querySelector('.toast-stack');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-stack';
      document.body.appendChild(el);
    }
    return el;
  };

  function toast(message, type = 'info', duration = 3500) {
    const stack = toastStack();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    const iconColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#06b6d4';
    const iconEl = document.createElement('span');
    iconEl.style.fontWeight = '700';
    iconEl.style.color = iconColor;
    iconEl.textContent = icon;
    const msgEl = document.createElement('span');
    msgEl.textContent = message;
    t.append(iconEl, msgEl);
    stack.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'toastIn 0.3s ease reverse';
      setTimeout(() => t.remove(), 300);
    }, duration);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function setupNavToggle() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('nav.primary-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  }

  function setupFadeIn() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.fade-in').forEach((el) => el.classList.add('visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.fade-in').forEach((el) => io.observe(el));
  }

  function highlightActiveNav() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav.primary-nav a').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('active');
      }
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /**
   * Populate a `.notice` element with a description of which provider Lumen
   * will route generations to. `flow` is one of 'text', 'image', 'video' and
   * affects whether the active provider can actually do real generation for
   * that flow (HF only supports text→video; the proxy providers support all
   * three; built-in is always demo).
   */
  function renderProviderNotice(el, flow) {
    if (!el || typeof VideoAPI === 'undefined') return;
    el.replaceChildren();
    const provider = VideoAPI.activeProvider();
    const hasHfKey = VideoAPI.hasKey('huggingface');
    let mode = 'builtin'; // builtin | real | fallback
    let body = '';
    if (provider === 'huggingface' && hasHfKey && flow === 'text') {
      mode = 'real';
    } else if (provider === 'huggingface' && hasHfKey) {
      mode = 'fallback';
      body = 'Hugging Face is selected but it has no free model for this flow. Lumen is using the Devin built-in clip library instead.';
    } else if (provider === 'huggingface') {
      mode = 'fallback';
      body = 'Hugging Face is selected but no token is saved. Add one in Settings, or stay on the Devin built-in clip library.';
    } else if (provider !== 'devin-builtin') {
      // Replicate / Stability / etc. Need both a key AND a proxy URL.
      const proxyUrl = (Storage.getSettings().proxyUrl || '').trim();
      if (VideoAPI.hasKey(provider) && proxyUrl) {
        mode = 'real';
      } else {
        mode = 'fallback';
        body = `${provider} is selected but it requires a proxy URL${VideoAPI.hasKey(provider) ? '' : ' and an API key'}. Lumen is using the Devin built-in clip library instead.`;
      }
    }
    if (mode === 'real') {
      el.style.display = 'none';
      return;
    }
    if (mode === 'builtin') {
      body = 'Lumen is routing prompts to the Devin built-in clip library — a curated set of CC0 sample MP4s picked by your prompt keywords. Switch to Hugging Face in Settings for real generation.';
    }
    el.style.display = 'block';
    const strong = document.createElement('strong');
    strong.textContent = mode === 'builtin' ? 'Devin built-in active.' : 'Heads up:';
    const space = document.createTextNode(' ');
    const text = document.createTextNode(body);
    const link = document.createElement('a');
    link.href = 'settings.html';
    link.textContent = 'Open Settings';
    link.style.marginLeft = '6px';
    el.append(strong, space, text, document.createTextNode(' '), link);
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupNavToggle();
    setupFadeIn();
    highlightActiveNav();
  });

  return { toast, downloadBlob, formatDate, escapeHtml, renderProviderNotice };
})();

window.App = App;
