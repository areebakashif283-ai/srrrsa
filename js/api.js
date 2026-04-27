/**
 * API integration layer for video generation providers.
 *
 * This file is a HYBRID layer: when no API key is present, it returns a demo
 * placeholder video so the UI is fully functional for design review. When a key
 * is configured, it routes to the appropriate real provider.
 *
 * To enable real generation:
 *  1. Open Settings page and add an API key for one of the supported providers.
 *  2. Some providers (Replicate, RunwayML) require server-side calls due to CORS;
 *     deploy a tiny proxy endpoint and set its URL in Settings → "Proxy URL".
 *  3. The functions below try a direct browser call first, then fall back to
 *     the proxy if configured.
 */
const VideoAPI = (() => {
  // Public CC0 demo clip used when no key is configured (Big Buck Bunny short)
  const DEMO_VIDEO_URL =
    'https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files@4.2.16/big_buck_bunny.mp4';

  const PROVIDERS = {
    replicate: { label: 'Replicate', env: 'replicate' },
    stability: { label: 'Stability AI', env: 'stability' },
    runway: { label: 'RunwayML', env: 'runway' },
    pika: { label: 'Pika', env: 'pika' },
    luma: { label: 'Luma Dream Machine', env: 'luma' },
  };

  function activeProvider() {
    const settings = Storage.getSettings();
    return settings.activeProvider || 'replicate';
  }

  function hasKey(provider = activeProvider()) {
    return Boolean(Storage.getApiKey(provider));
  }

  function getProxyUrl() {
    const settings = Storage.getSettings();
    return settings.proxyUrl || '';
  }

  /**
   * Simulate a generation pipeline with progress callbacks.
   * Resolves with { videoUrl, demo: true } so the UI can mark it as a demo.
   */
  async function simulate({ onProgress, totalMs = 4500 }) {
    const start = Date.now();
    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, (elapsed / totalMs) * 100);
        if (onProgress) onProgress(pct);
        if (elapsed >= totalMs) {
          resolve({ videoUrl: DEMO_VIDEO_URL, demo: true });
        } else {
          setTimeout(tick, 120);
        }
      };
      tick();
    });
  }

  /**
   * Text → Video. Real implementation would POST to provider with the prompt.
   * Currently routes through simulate() unless a proxy URL is configured.
   */
  async function textToVideo({ prompt, duration, aspectRatio, style, onProgress }) {
    if (!prompt || !prompt.trim()) {
      throw new Error('Prompt is required.');
    }

    if (!hasKey() || !getProxyUrl()) {
      return await simulate({ onProgress });
    }

    const proxyUrl = getProxyUrl().replace(/\/$/, '');
    const provider = activeProvider();
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
   * Image → Video. Accepts a File or dataURL.
   */
  async function imageToVideo({ image, motion, prompt, duration, onProgress }) {
    if (!image) throw new Error('Source image is required.');

    if (!hasKey() || !getProxyUrl()) {
      return await simulate({ onProgress });
    }

    const proxyUrl = getProxyUrl().replace(/\/$/, '');
    const provider = activeProvider();
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
   * Video → Video (style transfer / restyle).
   */
  async function videoToVideo({ video, prompt, strength, onProgress }) {
    if (!video) throw new Error('Source video is required.');

    if (!hasKey() || !getProxyUrl()) {
      return await simulate({ onProgress });
    }

    const proxyUrl = getProxyUrl().replace(/\/$/, '');
    const provider = activeProvider();
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
    activeProvider,
    hasKey,
    textToVideo,
    imageToVideo,
    videoToVideo,
    DEMO_VIDEO_URL,
  };
})();

window.VideoAPI = VideoAPI;
