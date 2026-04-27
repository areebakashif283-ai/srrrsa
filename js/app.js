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

  return { toast, downloadBlob, formatDate, escapeHtml };
})();

window.App = App;
