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

  const state = { motion: 'subtle', file: null, thumbPromise: null, currentVideoUrl: null };

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

  const durationVal = document.getElementById('duration-val');
  durationEl.addEventListener('input', () => {
    const val = `${durationEl.value}s`;
    durationDisplay.textContent = val;
    if (durationVal) durationVal.textContent = val;
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
    const objectUrl = URL.createObjectURL(file);
    if (previewImage.src && previewImage.src.startsWith('blob:')) {
      URL.revokeObjectURL(previewImage.src);
    }
    previewImage.src = objectUrl;
    previewImage.style.display = 'block';
    generateBtn.disabled = false;
    // Build a tiny thumbnail (max 256px) for localStorage so we don't hit the quota.
    // Store the promise so generate() can await the thumbnail tied to THIS file,
    // avoiding races where the user clicks Generate before it resolves or swaps
    // images quickly and a stale thumbnail wins.
    state.thumbPromise = buildThumbnail(file, 256).catch(() => null);
  }

  function buildThumbnail(file, maxDim) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
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
      App.toast('Upload an image first.', 'error');
      return;
    }
    // Pin everything that identifies THIS submission to local consts so a user
    // who swaps the image / changes settings while the API call is in flight
    // can't poison the history entry we save when generation finishes.
    const submission = {
      file: state.file,
      thumbPromise: state.thumbPromise,
      motion: state.motion,
      duration: Number(durationEl.value),
      prompt: promptEl.value,
    };
    generateBtn.disabled = true;
    previewActions.style.display = 'none';
    showLoading();
    const progressBar = document.getElementById('progress-bar');
    const status = document.getElementById('loading-status');
    const stages = ['Analyzing image…', 'Estimating motion vectors…', 'Rendering frames…', 'Polishing output…'];

    try {
      const result = await VideoAPI.imageToVideo({
        image: submission.file,
        motion: submission.motion,
        duration: submission.duration,
        prompt: submission.prompt,
        onProgress: (pct) => {
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (status) {
            const idx = Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length));
            status.textContent = stages[idx];
          }
        },
      });
      showResult(result.videoUrl, result.demo);
      const sourceImage = submission.thumbPromise ? await submission.thumbPromise : null;
      try {
        Storage.addHistory({
          type: 'image-to-video',
          prompt: submission.prompt,
          motion: submission.motion,
          duration: submission.duration,
          sourceImage,
          videoUrl: result.videoUrl,
          demo: result.demo,
        });
      } catch (storageErr) {
        console.warn('History save failed (storage quota?)', storageErr);
        App.toast('Saved video, but history is full.', 'info');
      }
      App.toast(result.demo ? 'Demo animation ready.' : 'Animation generated!', 'success');
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
      App.downloadBlob(blob, `lumen-image-${Date.now()}.mp4`);
    } catch {
      window.open(state.currentVideoUrl, '_blank');
    }
  });
})();
