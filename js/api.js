/**
 * API integration layer for video generation providers.
 *
 * Supported providers:
 *  - devin-builtin (default): a no-key, no-network "Devin built-in" provider
 *    that picks a curated CC0 sample clip based on prompt/style keywords.
 *  - huggingface: real text-to-video using the public Hugging Face Inference
 *    API. Free-tier eligible; user supplies an HF token in Settings. Direct
 *    browser calls work because the HF API allows CORS.
 *  - replicate / stability / runway / pika / luma: real generation via a
 *    user-supplied proxy URL (these providers don't allow direct browser
 *    calls, so the proxy is required).
 *
 * Image→Video and Video→Video on the Hugging Face provider transparently fall
 * back to the built-in path because there is no good free-tier model for those
 * two flows (SVD is gated, and there is no public text-conditioned vid→vid).
 */
const VideoAPI = (() => {
  // Curated CC0 sample clips hosted on Google's public sample bucket. Each
  // clip has a few prompt keywords; we pick the best match per generation so
  // built-in output feels at least a little prompt-aware.
  const BUILTIN_CLIPS = [
    {
      id: 'adventure',
      label: 'Cinematic adventure',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      keywords: ['adventure', 'journey', 'epic', 'travel', 'escape', 'hero', 'road', 'mountain', 'desert', 'samurai'],
    },
    {
      id: 'fantasy',
      label: 'Fantasy dreamscape',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      keywords: ['fantasy', 'dream', 'dragon', 'magic', 'mystical', 'mage', 'wizard', 'sintel', 'snow', 'ice'],
    },
    {
      id: 'surreal',
      label: 'Surreal mechanical',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      keywords: ['surreal', 'abstract', 'industrial', 'mechanical', 'dream', 'gears', 'metal', 'sci-fi', 'futuristic', 'cyberpunk'],
    },
    {
      id: 'cartoon',
      label: 'Animated cartoon',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      keywords: ['cartoon', 'anime', 'funny', 'cute', 'animal', 'rabbit', 'forest', 'comedy', 'kid', 'pixar'],
    },
    {
      id: 'action',
      label: 'High-energy action',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      keywords: ['action', 'fire', 'burn', 'explosion', 'energy', 'intense', 'neon', 'fast', 'race'],
    },
    {
      id: 'joyride',
      label: 'Sunny joyride',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      keywords: ['joy', 'happy', 'sunny', 'party', 'ride', 'beach', 'summer', 'vacation', 'family'],
    },
  ];
  const FALLBACK_CLIP_URL = BUILTIN_CLIPS[0].url;

  // Default text-to-video model on Hugging Face. Free-tier eligible. Returns
  // a small (~16 frame, ~256x256) MP4. Slow on cold start (model load), so we
  // surface the wait time to the caller.
  const HF_T2V_MODEL = 'damo-vilab/text-to-video-ms-1.7b';

  const PROVIDERS = {
    'devin-builtin': { label: 'Devin built-in', requiresKey: false, requiresProxy: false },
    huggingface: { label: 'Hugging Face', requiresKey: true, requiresProxy: false, keyHelp: 'Free token at huggingface.co/settings/tokens' },
    replicate: { label: 'Replicate', requiresKey: true, requiresProxy: true },
    stability: { label: 'Stability AI', requiresKey: true, requiresProxy: true },
    runway: { label: 'RunwayML', requiresKey: true, requiresProxy: true },
    pika: { label: 'Pika', requiresKey: true, requiresProxy: true },
    luma: { label: 'Luma Dream Machine', requiresKey: true, requiresProxy: true },
  };

  function activeProvider() {
    const settings = Storage.getSettings();
    return settings.activeProvider || 'devin-builtin';
  }

  function hasKey(provider = activeProvider()) {
    return Boolean(Storage.getApiKey(provider));
  }

  function getProxyUrl() {
    const settings = Storage.getSettings();
    return settings.proxyUrl || '';
  }

  function pickBuiltinClip({ prompt, style } = {}) {
    const haystack = `${prompt || ''} ${style || ''}`.toLowerCase();
    let best = null;
    let bestScore = 0;
    for (const clip of BUILTIN_CLIPS) {
      const score = clip.keywords.reduce((s, kw) => (haystack.includes(kw) ? s + 1 : s), 0);
      if (score > bestScore) {
        best = clip;
        bestScore = score;
      }
    }
    if (best) return best;
    // No keyword hit — pick deterministically based on prompt hash so the
    // same prompt always returns the same clip (so tests are reproducible).
    const seed = haystack.length
      ? Array.from(haystack).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
      : Date.now();
    return BUILTIN_CLIPS[seed % BUILTIN_CLIPS.length];
  }

  /**
   * Built-in "Devin Studio" simulation. Reports progress over `totalMs` and
   * resolves with a curated sample clip URL. `demo: true` so the UI can label
   * it as a built-in sample.
   */
  async function simulateBuiltin({ onProgress, totalMs = 4500, prompt, style }) {
    const clip = pickBuiltinClip({ prompt, style });
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, (elapsed / totalMs) * 100);
        if (onProgress) onProgress(pct);
        if (elapsed >= totalMs) {
          resolve({ videoUrl: clip.url, demo: true, builtinClipLabel: clip.label });
        } else {
          setTimeout(tick, 120);
        }
      };
      tick();
    });
  }

  /**
   * Call the Hugging Face Inference API for text-to-video. Handles the
   * "model is loading" 503 by waiting `estimated_time` seconds and retrying
   * once. Returns a blob: URL the <video> tag can play directly.
   *
   * Note: the returned blob URL is owned by the calling page and will be
   * freed when the page unloads. Studios that re-generate revoke the previous
   * URL before assigning a new one.
   */
  async function huggingfaceTextToVideo({ prompt, onProgress, model = HF_T2V_MODEL }) {
    const token = Storage.getApiKey('huggingface');
    if (!token) throw new Error('Hugging Face token missing — add it in Settings.');

    const url = `https://api-inference.huggingface.co/models/${model}`;
    const body = JSON.stringify({ inputs: prompt });
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    if (onProgress) onProgress(5);
    let resp = await fetch(url, { method: 'POST', headers, body });
    if (resp.status === 503) {
      // Cold-start: read the estimated time and try once more.
      let estimatedSec = 30;
      try {
        const info = await resp.json();
        if (info && typeof info.estimated_time === 'number') {
          estimatedSec = Math.min(120, Math.max(10, Math.ceil(info.estimated_time)));
        }
      } catch {
        /* ignore */
      }
      // Animate the progress bar through the wait so the UI doesn't look stuck.
      const start = Date.now();
      const totalMs = estimatedSec * 1000;
      await new Promise((resolve) => {
        const tick = () => {
          const elapsed = Date.now() - start;
          const pct = Math.min(80, 5 + (elapsed / totalMs) * 75);
          if (onProgress) onProgress(pct);
          if (elapsed >= totalMs) resolve();
          else setTimeout(tick, 200);
        };
        tick();
      });
      resp = await fetch(url, { method: 'POST', headers, body });
    }
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const info = await resp.json();
        if (info && info.error) detail = info.error;
      } catch {
        /* ignore */
      }
      throw new Error(`Hugging Face: ${detail}`);
    }
    if (onProgress) onProgress(95);
    const blob = await resp.blob();
    if (onProgress) onProgress(100);
    const videoUrl = URL.createObjectURL(blob);
    return { videoUrl, demo: false, providerLabel: 'Hugging Face', isBlob: true };
  }

  /**
   * Text → Video. Routes by active provider.
   */
  async function textToVideo({ prompt, duration, aspectRatio, style, onProgress }) {
    if (!prompt || !prompt.trim()) {
      throw new Error('Prompt is required.');
    }
    const provider = activeProvider();

    if (provider === 'huggingface') {
      if (!hasKey('huggingface')) {
        // No key: gracefully fall back to built-in so the UI still works.
        return await simulateBuiltin({ onProgress, prompt, style });
      }
      return await huggingfaceTextToVideo({ prompt, onProgress });
    }

    if (provider === 'devin-builtin' || !hasKey() || !getProxyUrl()) {
      return await simulateBuiltin({ onProgress, prompt, style });
    }

    const proxyUrl = getProxyUrl().replace(/\/$/, '');
    const apiKey = Storage.getApiKey(provider);
    const response = await fetch(`${proxyUrl}/text-to-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, prompt, duration, aspectRatio, style }),
    });
    if (!response.ok) throw new Error(`Provider error: ${response.status}`);
    const data = await response.json();
    return { videoUrl: data.videoUrl, demo: false };
  }

  /**
   * Image → Video. Accepts a File or dataURL. HF doesn't have a good free-tier
   * image-to-video model so the HF provider falls back to built-in here.
   */
  async function imageToVideo({ image, motion, prompt, duration, onProgress }) {
    if (!image) throw new Error('Source image is required.');
    const provider = activeProvider();

    if (provider === 'devin-builtin' || provider === 'huggingface' || !hasKey() || !getProxyUrl()) {
      return await simulateBuiltin({ onProgress, prompt, style: motion });
    }

    const proxyUrl = getProxyUrl().replace(/\/$/, '');
    const apiKey = Storage.getApiKey(provider);

    const form = new FormData();
    form.append('provider', provider);
    form.append('apiKey', apiKey);
    form.append('motion', motion || 'subtle');
    form.append('prompt', prompt || '');
    form.append('duration', String(duration ?? 4));
    if (image instanceof File) {
      form.append('image', image);
    } else {
      form.append('imageDataUrl', image);
    }

    const response = await fetch(`${proxyUrl}/image-to-video`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error(`Provider error: ${response.status}`);
    const data = await response.json();
    return { videoUrl: data.videoUrl, demo: false };
  }

  /**
   * Video → Video (style transfer / restyle). HF and built-in both fall back
   * to a curated sample clip for now.
   */
  async function videoToVideo({ video, prompt, strength, style, onProgress }) {
    if (!video) throw new Error('Source video is required.');
    const provider = activeProvider();

    if (provider === 'devin-builtin' || provider === 'huggingface' || !hasKey() || !getProxyUrl()) {
      return await simulateBuiltin({ onProgress, prompt, style });
    }

    const proxyUrl = getProxyUrl().replace(/\/$/, '');
    const apiKey = Storage.getApiKey(provider);

    const form = new FormData();
    form.append('provider', provider);
    form.append('apiKey', apiKey);
    form.append('prompt', prompt || '');
    form.append('strength', String(strength ?? 0.5));
    form.append('video', video);

    const response = await fetch(`${proxyUrl}/video-to-video`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error(`Provider error: ${response.status}`);
    const data = await response.json();
    return { videoUrl: data.videoUrl, demo: false };
  }

  return {
    PROVIDERS,
    BUILTIN_CLIPS,
    activeProvider,
    hasKey,
    pickBuiltinClip,
    textToVideo,
    imageToVideo,
    videoToVideo,
    FALLBACK_CLIP_URL,
  };
})();

window.VideoAPI = VideoAPI;
