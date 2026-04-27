// Image-to-video page logic
(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const previewImage = document.getElementById('preview-image');
  const generateBtn = document.getElementById('generate-btn');
  const durationEl = document.getElementById('duration');
  const durationDisplay = document.getElementById('duration-display');
  const previewStage = document.getElementById('preview-stage');
  const previewActions = document.getElementById('preview-actions');
  const downloadBtn = document.getElementById('download-btn');
  const regenBtn = document.getElementById('regen-btn');
  const apiNotice = document.getElementById('api-notice');
  const promptEl = document.getElementById('img-prompt');

  const state = { motion: 'subtle', file: null, dataUrl: null, currentVideoUrl: null };

  if (!VideoAPI.hasKey()) apiNotice.style.display = 'block';

  function setupChips(name) {
    document.querySelectorAll(`[data-chip-group="${name}"] .chip`).forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll(`[data-chip-group="${name}"] .chip`).forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state[name] = chip.dataset.value;
      });
    });
  }
  setupChips('motion');

  durationEl.addEventListener('input', () => {
    durationDisplay.textContent = `${durationEl.value}s`;
  });

  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      App.toast('Please pick an image file.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      App.toast('Image too large (max 10 MB).', 'error');
      return;
    }
    state.file = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.dataUrl = e.target.result;
      previewImage.src = state.dataUrl;
      previewImage.style.display = 'block';
      generateBtn.disabled = false;
    };
    reader.readAsDataURL(file);
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
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    handleFile(file);
  });

  function showLoading() {
    previewStage.innerHTML = `
      <div class="preview-loading">
        <div class="spinner"></div>
        <p id="loading-status">Analyzing image…</p>
        <div class="progress"><div class="progress-bar" id="progress-bar"></div></div>
      </div>`;
  }

  function showResult(videoUrl, demo) {
    previewStage.innerHTML = `
      <video class="preview-video-result" controls autoplay muted loop playsinline src="${videoUrl}"></video>
      ${demo ? '<span class="badge beta" style="position:absolute;top:14px;right:14px;">Demo output</span>' : ''}
    `;
    previewActions.style.display = 'flex';
    state.currentVideoUrl = videoUrl;
  }

  async function generate() {
    if (!state.file) {
      App.toast('Upload an image first.', 'error');
      return;
    }
    generateBtn.disabled = true;
    previewActions.style.display = 'none';
    showLoading();
    const progressBar = document.getElementById('progress-bar');
    const status = document.getElementById('loading-status');
    const stages = ['Analyzing image…', 'Estimating motion vectors…', 'Rendering frames…', 'Polishing output…'];

    try {
      const result = await VideoAPI.imageToVideo({
        image: state.file,
        motion: state.motion,
        duration: Number(durationEl.value),
        prompt: promptEl.value,
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
        type: 'image-to-video',
        prompt: promptEl.value,
        motion: state.motion,
        duration: Number(durationEl.value),
        sourceImage: state.dataUrl,
        videoUrl: result.videoUrl,
        demo: result.demo,
      });
      App.toast(result.demo ? 'Demo animation ready.' : 'Animation generated!', 'success');
    } catch (err) {
      previewStage.innerHTML = `<div class="preview-empty"><h3 style="color:#ef4444;">Generation failed</h3><p>${err.message || 'Try again.'}</p></div>`;
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
      App.downloadBlob(blob, `lumen-image-${Date.now()}.mp4`);
    } catch {
      window.open(state.currentVideoUrl, '_blank');
    }
  });
})();
