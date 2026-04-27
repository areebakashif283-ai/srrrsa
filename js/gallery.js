// Gallery rendering and modal player
(function () {
  const content = document.getElementById('gallery-content');
  const filterGroup = document.getElementById('filter-group');
  const clearBtn = document.getElementById('clear-btn');
  const modal = document.getElementById('player-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalVideo = document.getElementById('modal-video');
  const modalPrompt = document.getElementById('modal-prompt');
  const modalClose = document.getElementById('modal-close');
  const modalDownload = document.getElementById('modal-download');
  const modalDelete = document.getElementById('modal-delete');

  let activeFilter = 'all';
  let activeItem = null;

  const TYPE_LABEL = {
    'text-to-video': 'Text → Video',
    'image-to-video': 'Image → Video',
    'video-to-video': 'Video Restyle',
  };

  function render() {
    let items = Storage.getHistory();
    if (activeFilter !== 'all') items = items.filter((it) => it.type === activeFilter);

    if (!items.length) {
      content.innerHTML = `
        <div class="gallery-empty">
          <div class="icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2"></rect></svg>
          </div>
          <h3 style="font-family:var(--font-display); margin-bottom:8px; color:var(--text);">No generations yet</h3>
          <p>Create your first video and it will appear here.</p>
          <a class="btn btn-primary" href="text-to-video.html" style="margin-top:18px;">Open studio</a>
        </div>
      `;
      return;
    }

    content.innerHTML = `<div class="gallery-grid">${items.map(renderItem).join('')}</div>`;
    document.querySelectorAll('.gallery-item').forEach((el) => {
      el.addEventListener('click', () => openItem(el.dataset.id));
    });
  }

  function renderItem(it) {
    const title = it.prompt
      ? it.prompt.slice(0, 80) + (it.prompt.length > 80 ? '…' : '')
      : TYPE_LABEL[it.type];
    const thumb = it.sourceImage
      ? `<img src="${it.sourceImage}" alt="" />`
      : `<video src="${it.videoUrl}" muted preload="metadata"></video>`;
    return `
      <div class="gallery-item" data-id="${it.id}">
        <div class="thumb">
          ${thumb}
          <div class="play-overlay">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
          ${it.demo ? '<span class="badge beta" style="position:absolute; top:8px; left:8px;">Demo</span>' : ''}
        </div>
        <div class="meta">
          <div class="meta-title">${escapeHtml(title)}</div>
          <div class="meta-sub"><span>${TYPE_LABEL[it.type]}</span><span>${App.formatDate(it.createdAt)}</span></div>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function openItem(id) {
    const item = Storage.getHistory().find((x) => x.id === id);
    if (!item) return;
    activeItem = item;
    modalTitle.textContent = TYPE_LABEL[item.type];
    modalMeta.textContent = `${App.formatDate(item.createdAt)}${item.demo ? ' · Demo output' : ''}`;
    modalVideo.src = item.videoUrl;
    modalPrompt.textContent = item.prompt || '';
    modal.classList.add('open');
  }

  function closeModal() {
    modal.classList.remove('open');
    modalVideo.pause();
    modalVideo.src = '';
    activeItem = null;
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modalDownload.addEventListener('click', async () => {
    if (!activeItem) return;
    try {
      const res = await fetch(activeItem.videoUrl);
      const blob = await res.blob();
      App.downloadBlob(blob, `lumen-${activeItem.type}-${activeItem.id}.mp4`);
    } catch {
      window.open(activeItem.videoUrl, '_blank');
    }
  });

  modalDelete.addEventListener('click', () => {
    if (!activeItem) return;
    if (!confirm('Delete this generation?')) return;
    Storage.removeHistory(activeItem.id);
    closeModal();
    render();
    App.toast('Generation deleted.', 'info');
  });

  filterGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#filter-group .chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });

  clearBtn.addEventListener('click', () => {
    if (!Storage.getHistory().length) return;
    if (!confirm('Clear your entire generation history?')) return;
    Storage.clearHistory();
    render();
    App.toast('History cleared.', 'info');
  });

  render();
})();
