// Text-to-video page logic
(function () {
  const promptEl = document.getElementById('prompt');
  const durationEl = document.getElementById('duration');
  const durationDisplay = document.getElementById('duration-display');
  const generateBtn = document.getElementById('generate-btn');
  const previewStage = document.getElementById('preview-stage');
  const previewActions = document.getElementById('preview-actions');
  const downloadBtn = document.getElementById('download-btn');
  const regenBtn = document.getElementById('regen-btn');
  const apiNotice = document.getElementById('api-notice');

  const state = { style: 'cinematic', aspect: '16:9', currentVideoUrl: null };

  function updateNotice() {
    if (!VideoAPI.hasKey()) apiNotice.style.display = 'block';
    else apiNotice.style.display = 'none';
  }
  updateNotice();

  function setupChips(name) {
    document.querySelectorAll(`[data-chip-group="${name}"] .chip`).forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll(`[data-chip-group="${name}"] .chip`).forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state[name] = chip.dataset.value;
      });
    });
  }
  setupChips('style');
  setupChips('aspect');

  document.querySelectorAll('.chip[data-example]').forEach((chip) => {
    chip.addEventListener('click', () => {
      promptEl.value = chip.dataset.example;
      promptEl.focus();
    });
  });

  const durationVal = document.getElementById('duration-val');
  durationEl.addEventListener('input', () => {
    const val = `${durationEl.value}s`;
    durationDisplay.textContent = val;
    if (durationVal) durationVal.textContent = val;
  });

  function showLoading() {
    previewStage.innerHTML = `
      <div class="preview-loading">
        <div class="spinner"></div>
        <p id="loading-status">Conjuring frames…</p>
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
    p.textContent = message || 'Try again or check your provider settings.';
    wrap.append(h3, p);
    previewStage.appendChild(wrap);
  }

  async function generate() {
    const prompt = promptEl.value.trim();
    if (!prompt) {
      App.toast('Please enter a prompt first.', 'error');
      promptEl.focus();
      return;
    }
    generateBtn.disabled = true;
    previewActions.style.display = 'none';
    showLoading();
    const progressBar = document.getElementById('progress-bar');
    const status = document.getElementById('loading-status');
    const stages = ['Conjuring frames…', 'Rendering motion…', 'Color grading…', 'Almost there…'];

    try {
      const result = await VideoAPI.textToVideo({
        prompt,
        duration: Number(durationEl.value),
        aspectRatio: state.aspect,
        style: state.style,
        onProgress: (pct) => {
          if (progressBar) progressBar.style.width = `${pct}%`;
          if (status) {
            const idx = Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length));
            status.textContent = stages[idx];
          }
        },
      });
      showResult(result.videoUrl, result.demo);
      try {
        Storage.addHistory({
          type: 'text-to-video',
          prompt,
          style: state.style,
          aspect: state.aspect,
          duration: Number(durationEl.value),
          videoUrl: result.videoUrl,
          demo: result.demo,
        });
      } catch (storageErr) {
        console.warn('History save failed', storageErr);
        App.toast('Saved video, but history is full.', 'info');
      }
      App.toast(result.demo ? 'Demo video ready.' : 'Video generated successfully!', 'success');
    } catch (err) {
      console.error(err);
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
      App.downloadBlob(blob, `lumen-text-${Date.now()}.mp4`);
    } catch {
      window.open(state.currentVideoUrl, '_blank');
    }
  });
})();
