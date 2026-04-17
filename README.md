# ⬡ Frame Extractor

A cross-platform desktop app (Mac + Windows) that converts any video into
individual frames at any FPS using **FFmpeg** under the hood.

---

## Features

| Feature | Detail |
|---|---|
| Any FPS | 1 fps → 1000 fps (or any decimal like 0.5) |
| Presets | 1 / 12 / 24 / 30 / 60 / 120 / 200 / Custom |
| Formats | PNG, JPG, WebP |
| Quality | Adjustable quality slider |
| Resize | 4K / 2K / FHD / HD / 480p / Custom W×H |
| Trim | Optional start/end time clip before extraction |
| Progress | Live frame count + % progress bar |
| Output | Auto-named sub-folder per job |

---

## Prerequisites

- **Node.js** ≥ 18 — https://nodejs.org
- `npm` comes with Node.js

---

## Quick Start (Development)

```bash
# 1. Clone / unzip this folder, then:
cd frame-extractor

# 2. Install dependencies  (this downloads Electron + ffmpeg-static)
npm install

# 3. Run the app
npm start
```

---

## Build a Distributable

### macOS (.dmg)
```bash
npm run build:mac
```
Output: `dist/Frame Extractor-1.0.0.dmg`

### Windows (.exe installer)
```bash
npm run build:win
```
Output: `dist/Frame Extractor Setup 1.0.0.exe`

### Both platforms at once
```bash
npm run build:all
```

> **Note:** Building for Windows from macOS requires Wine or a Windows runner.
> Use GitHub Actions or a Windows machine for cross-platform builds.

---

## Project Structure

```
frame-extractor/
├── package.json          # Dependencies + electron-builder config
├── src/
│   ├── main.js           # Electron main process (FFmpeg, IPC, window)
│   ├── preload.js        # Secure IPC bridge (contextBridge)
│   ├── index.html        # App shell
│   ├── styles.css        # All styles
│   └── renderer.js       # All UI logic
└── assets/
    ├── icon.icns         # macOS icon  (you supply this)
    ├── icon.ico          # Windows icon (you supply this)
    └── icon.png          # 512×512 PNG  (you supply this)
```

---

## How It Works

1. User picks a video file (drag & drop or file browser)
2. `ffprobe` reads metadata (duration, resolution, native FPS)
3. User sets target FPS, format, quality, optional resize/trim
4. User picks an output folder
5. App runs:
   ```
   ffmpeg -i input.mp4 -vf "fps=120,scale=1920:1080" frame_%06d.png
   ```
6. Frames land in a timestamped sub-folder
7. "Open Folder" button reveals the output in Finder / Explorer

---

## Adding App Icons

Place these files in `assets/`:
- `icon.icns` — macOS (use `iconutil` or https://cloudconvert.com)
- `icon.ico`  — Windows (use https://icoconvert.com)
- `icon.png`  — 512×512 PNG (used as fallback)

---

## License

MIT
