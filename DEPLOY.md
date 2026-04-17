# Frame Extractor — Bug Audit & Vercel Deployment Guide

> Complete audit of all bugs found + fixed, and step-by-step instructions
> for deploying to Vercel from a **private** GitHub repository using the Vercel CLI.

---

## ✅ Can You Deploy a Private Repo to Vercel?

**Yes, absolutely.** Two options:

| Method | Works With Private Repo? | How |
|--------|--------------------------|-----|
| **Vercel CLI (`vercel deploy`)** | ✅ Yes | Deploys directly from your local filesystem. No GitHub connection needed at all. |
| **Vercel Dashboard (Git Integration)** | ✅ Yes | Connect your private GitHub repo via OAuth. Vercel can read private repos once you authorize it. |

**We are using the CLI method** — it's faster, doesn't require GitHub integration, and works immediately.

---

## 🐛 Bug Audit — All Issues Found & Fixed

### BUG-1: 🔴 FIXED — Three.js particle jitter on scroll
- **File:** `site/three-hero.js` (scroll handler)
- **Problem:** `Math.random()` was called on every scroll event for every particle, causing particles to jump to random positions 60 times/sec. Visual nightmare.
- **Fix:** Pre-compute a `noiseOffsets[]` array at init time. Scroll handler now uses deterministic `noise.x * scrollRatio` instead of `Math.random()`.
- **Bonus:** Capped `devicePixelRatio` at 2 for performance on Retina displays. Added `{ passive: true }` to scroll listener.

### BUG-2: 🔴 FIXED — Redundant Three.js CDN `<script>` tag
- **File:** `site/index.html` line 171
- **Problem:** A `<script type="module" src="...three.module.min.js">` existed alongside `three-hero.js` which has its own `import * as THREE from '...'`. This loaded Three.js twice (~600KB wasted).
- **Fix:** Removed the standalone script tag. `three-hero.js` handles its own import.

### BUG-3: 🟡 FIXED — GitHub footer link will 404 after making repo private
- **File:** `site/index.html` footer
- **Problem:** Footer had `<a href="https://github.com/MANOSHRANJAN/frame-extractor">View on GitHub</a>`. After making repo private, visitors get a 404.
- **Fix:** Changed to `<a href="mailto:manoshranjan@outlook.com">Contact</a>`.

### BUG-4: 🟡 FIXED — `.gitignore` missing entries
- **File:** `.gitignore`
- **Problem:** `AUDIT.md`, `scripts/`, and `.vercel/` were not ignored. CI lint artifacts and local Vercel config would get pushed.
- **Fix:** Added all three to `.gitignore`.

### BUG-5: 🟢 VERIFIED OK — Vercel rewrite rules
- **File:** `vercel.json`
- **Status:** Rewrites correctly route `/` → `/site/index.html` and COI headers are set for `/web/(.*)`.
- **Note:** The site references its assets with `./styles.css` etc. which resolves correctly because the HTML is served from `/site/`. No additional rewrites needed for relative paths.

### BUG-6: 🟢 VERIFIED OK — OS detection in `script.js`
- **File:** `site/script.js`
- **Status:** `document.getElementById('btnHeroDl')` correctly matches `id="btnHeroDl"` in the HTML. OS detection configures both the hero CTA and the pricing table button. Supabase tracking attaches to all `<a>` elements with `data-platform` or `.dmg`/`.exe` URLs.

### BUG-7: 🟢 VERIFIED OK — Web demo 30 FPS cap
- **File:** `web/app.js` line 183
- **Status:** `getSelectedFps()` returns `Math.min(selectedFps, 30)`. The 60 and 120 FPS buttons are `disabled` with lock icons. Working correctly.

### BUG-8: 🟢 VERIFIED OK — Electron desktop app
- **File:** `src/main.js`
- **Status:** FFmpeg path resolution, IPC handlers, and extraction pipeline all look correct. The `copy-ffmpeg` build script in `package.json` populates `ffmpeg-bin/` before electron-builder runs.

---

## 🚀 Vercel Deployment — Step by Step

### Prerequisites
- Vercel CLI is installed: ✅ `Vercel CLI 50.44.0` detected
- `vercel.json` is configured: ✅ Rewrites + COI headers ready

### Step 1: Login to Vercel (one-time)

```bash
npx vercel login
```

This opens a browser window. Sign in with your Vercel account (email, GitHub, or GitLab).

### Step 2: Deploy the project

```bash
cd /Users/manoshranjan/Downloads/frame-extractor
npx vercel deploy --prod
```

**During the interactive setup, answer:**

| Prompt | Answer |
|--------|--------|
| Set up and deploy? | `Y` |
| Which scope? | Your Vercel account |
| Link to existing project? | `N` (create new) |
| Project name? | `frame-extractor` |
| In which directory is your code located? | `./` (root — vercel.json handles routing) |
| Override settings? | `N` |

### Step 3: Verify deployment

Once deployed, Vercel will print a URL like:
```
https://frame-extractor.vercel.app
```

**Test these routes:**

| URL | Expected |
|-----|----------|
| `/` | Marketing landing page with Three.js particles |
| `/site/index.html` | Same as above (direct path) |
| `/web/index.html` | Web demo (FFmpeg WASM) |
| `/web/app.js` | Should load with COI headers |

### Step 4: Verify COI headers

```bash
curl -I https://frame-extractor.vercel.app/web/index.html 2>/dev/null | grep -i "cross-origin"
```

Expected output:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

---

## 📋 Post-Deployment Checklist

- [ ] Visit `https://your-url.vercel.app` → marketing page loads with animated particle sphere
- [ ] Click hero download button → gets correct OS-specific link
- [ ] Click "Launch Web App" → web demo loads at `/web/index.html`
- [ ] Upload a video in web demo → extraction works, ZIP downloads
- [ ] 60/120 FPS buttons show 🔒 and are disabled
- [ ] Scroll down on marketing page → particles dissolve smoothly (no jitter)
- [ ] Check browser console → no errors or failed loads
- [ ] Create Supabase `downloads` table (SQL below) → test tracking

### Supabase Table Creation SQL

Run this in **Supabase Dashboard → SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS downloads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL,
  version TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts"
  ON downloads FOR INSERT
  WITH CHECK (true);
```

---

## 🔒 Making the Repo Private

Since `gh` CLI has a permissions issue on this machine, do it manually:

1. Go to: `https://github.com/MANOSHRANJAN/frame-extractor/settings`
2. Scroll to **Danger Zone** at the bottom
3. Click **Change visibility** → **Make private**
4. Type the repo name to confirm

> **Note:** Making the repo private does NOT affect Vercel CLI deployments.
> The CLI deploys from your local filesystem, not from GitHub.

---

## 📁 Files Changed in This Session

| File | Change |
|------|--------|
| `site/three-hero.js` | Fixed particle jitter bug (pre-computed noise), capped pixel ratio, passive scroll |
| `site/index.html` | Removed redundant Three.js script tag, changed footer link |
| `.gitignore` | Added `AUDIT.md`, `scripts/`, `.vercel/` |
| `vercel.json` | Already correct — verified |
| `web/index.html` | Upsell link changed to absolute path (done in previous session) |
