// Video-to-video (restyle) page logic
(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const previewSource = document.getElementById('preview-source');
  const generateBtn = document.getElementById('generate-btn');
  const strengthEl = document.getElementById('strength');
  const strengthDisplay = document.getElementById('strength-display');
  const promptEl = document.getElementById('vid-prompt');
  const previewStage = document.getElementById('preview-stage');
  const previewActions = document.getElementById('preview-actions');
  const downloadBtn = document.getElementById('download-btn');
  const regenBtn = document.getElementById('regen-btn');
  const apiNotice = document.getElementById('api-notice');

  const state = { style: 'ghibli', file: null, currentVideoUrl: null };

  if (!VideoAPI.hasKey()) apiNotice.style.display = 'block';

  document.querySelectorAll('[data-chip-group="style"] .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('[data-chip-group="style"] .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.style = chip.dataset.value;
    });
  });

  const strengthVal = document.getElementById('strength-val');
  strengthEl.addEventListener('input', () => {
    strengthDisplay.textContent = strengthEl.value;
    if (strengthVal) strengthVal.textContent = strengthEl.value;
  });

  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      App.toast('Please pick a video file.', 'error');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      App.toast('Video too large (max 30 MB).', 'error');
      return;
    }
    state.file = file;
    if (previewSource.src && previewSource.src.startsWith('blob:')) {
      URL.revokeObjectURL(previewSource.src);
    }
    previewSource.src = URL.createObjectURL(file);
    previewSource.style.display = 'block';
    generateBtn.disabled = false;
  }

  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    })
  );
  dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

  function showLoading() {
    previewStage.innerHTML = `
      <div class="preview-loading">
        <div class="spinner"></div>
        <p id="loading-status">Analyzing footage…</p>
        <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>
      </div>`;
  }

  function showResult(videoUrl, demo) {
    previewStage.replaceChildren();
    const video = document.createElement('video');
    video.className = 'preview-video-result';
    video.controls = true;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.src = videoUrl;
    previewStage.appendChild(video);
    if (demo) {
      const badge = document.createElement('span');
      badge.className = 'badge beta';
      badge.style.cssText = 'position:absolute;top:14px;right:14px;';
      badge.textContent = 'Demo output';
      previewStage.appendChild(badge);
    }
    previewActions.style.display = 'flex';
    state.currentVideoUrl = videoUrl;
  }

  function showError(message) {
    previewStage.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'preview-empty';
    const h3 = document.createElement('h3');
    h3.style.color = '#ef4444';
    h3.textContent = 'Generation failed';
    const p = document.createElement('p');
    p.textContent = message || 'Try again.';
    wrap.append(h3, p);
    previewStage.appendChild(wrap);
  }

  async function generate() {
    if (!state.file) {
      App.toast('Upload a video first.', 'error');
      return;
    }
    generateBtn.disabled = true;
    previewActions.style.display = 'none';
    showLoading();
    const progressBar = document.getElementById('progress-bar');
    const status = document.getElementById('loading-status');
    const stages = ['Analyzing footage…', 'Extracting frames…', 'Applying style transfer…', 'Reassembling clip…'];

    try {
      const result = await VideoAPI.videoToVideo({
        video: state.file,
        prompt: promptEl.value || state.style,
        strength: Number(strengthEl.value),
        onProgress: (pct) => {
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (status) {
            const idx = Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length));
            status.textContent = stages[idx];
          }
        },
      });
      showResult(result.videoUrl, result.demo);
      Storage.addHistory({
        type: 'video-to-video',
        prompt: promptEl.value,
        style: state.style,
        strength: Number(strengthEl.value),
        videoUrl: result.videoUrl,
        demo: result.demo,
      });
      App.toast(result.demo ? 'Demo restyle ready.' : 'Restyle complete!', 'success');
    } catch (err) {
      showError(err.message);
      App.toast(err.message || 'Generation failed.', 'error');
    } finally {
      generateBtn.disabled = false;
    }
  }

  generateBtn.addEventListener('click', generate);
  regenBtn.addEventListener('click', generate);

  downloadBtn.addEventListener('click', async () => {
    if (!state.currentVideoUrl) return;
    try {
      const res = await fetch(state.currentVideoUrl);
      const blob = await res.blob();
      App.downloadBlob(blob, `lumen-restyle-${Date.now()}.mp4`);
    } catch {
      window.open(state.currentVideoUrl, '_blank');
    }
  });
})();
