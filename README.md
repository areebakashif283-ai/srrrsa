# Lumen Studio

> AI-powered video creation — text-to-video, image-to-video, and video restyle in one beautiful, dependency-free studio.

Lumen Studio is a fully client-side video creation app built with vanilla HTML, CSS, and JavaScript. No build step, no framework, no backend required to start exploring.

## Features

- **Text → Video** — Describe a scene and generate a short clip with style chips, aspect ratio and duration controls.
- **Image → Video** — Animate a still photo with motion presets (parallax, zoom, dolly, orbit) and an optional prompt.
- **Video Restyle** — Re-render an existing clip in a new style (Ghibli, claymation, oil painting, cyberpunk, etc).
- **Local Gallery** — Every generation is saved to `localStorage` and viewable in a filtered, modal player gallery.
- **Hybrid Mode** — Runs out of the box in *demo mode* with placeholder output. Plug in your API keys (Replicate, Stability, RunwayML, Pika, Luma) to enable real generation.
- **Glassmorphism UI** — Modern dark theme with animated particle background, gradient accents and smooth transitions.

## Project Structure

```
.
├── index.html              # Landing page
├── text-to-video.html      # Text → Video studio
├── image-to-video.html     # Image → Video studio
├── video-to-video.html     # Video Restyle studio
├── gallery.html            # Generation history with filters & modal player
├── settings.html           # API key management & active provider
├── css/style.css           # Design system + components
├── js/
│   ├── particles.js        # Animated background canvas
│   ├── app.js              # Shared utilities (toasts, nav, fade-in)
│   ├── storage.js          # localStorage settings & history layer
│   ├── api.js              # Provider abstraction with simulate fallback
│   ├── text-to-video.js    # Text → Video page logic
│   ├── image-to-video.js   # Image → Video page logic
│   ├── video-to-video.js   # Video Restyle page logic
│   ├── gallery.js          # Gallery rendering + modal player
│   └── settings.js         # Settings page logic
└── assets/                 # Logo + static assets
```

## Running locally

Because Lumen Studio is plain HTML/CSS/JS, you just need to open `index.html` — but a local server avoids any browser file:// quirks.

```bash
# Pick one
python3 -m http.server 8080
# or
npx serve .
```

Then open http://localhost:8080.

## Enabling real AI generation

Lumen ships in **demo mode**: every "Generate" action returns a placeholder MP4 so you can preview the entire workflow. To enable real generation:

1. Open **Settings** in the top-right nav.
2. Pick your active provider (Replicate, Stability, RunwayML, Pika, or Luma).
3. Paste your API key and click **Save**.
4. Most providers block direct browser calls (CORS), so deploy a tiny relay endpoint and paste its URL into the **Proxy URL** field. The app will POST to:
   - `POST /text-to-video` — JSON body `{ provider, apiKey, prompt, duration, aspectRatio, style }`
   - `POST /image-to-video` — multipart form (provider, apiKey, motion, duration, image)
   - `POST /video-to-video` — multipart form (provider, apiKey, prompt, strength, video)
   - Each endpoint should respond with `{ "videoUrl": "..." }`.

Once a key and proxy URL are configured, Lumen automatically routes through the proxy. If either is missing, it gracefully falls back to demo mode.

## Privacy

API keys are saved only in your browser's `localStorage`. They never leave your device unless you explicitly configure a proxy URL.

## Tech

- HTML5 + CSS3 (Grid, Flexbox, Custom Properties)
- Vanilla ES6+ JavaScript
- Google Fonts: Inter + Space Grotesk
- Canvas API for the animated particle background
- Zero dependencies, zero build step
