// src/renderer.js  —  Renderer Process (runs in the browser window)
'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  videoPath:    null,
  outputFolder: null,
  fps:          120,          // default
  customFps:    null,
  format:       'png',
  quality:      2,
  scale:        null,
  trimStart:    null,
  trimEnd:      null,
  activeJobId:  null,
  cleanupEvent: null,         // listener teardown fn
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const dropZone       = $('dropZone');
const btnPickVideo   = $('btnPickVideo');
const videoCard      = $('videoCard');
const videoThumb     = $('videoThumb');
const videoMeta      = $('videoMeta');
const btnClearVideo  = $('btnClearVideo');

const fpsPresets     = $('fpsPresets');
const customFpsRow   = $('customFpsRow');
const customFpsInput = $('customFpsInput');

const fmtGroup       = $('fmtGroup');
const qualitySlider  = $('qualitySlider');
const qualityVal     = $('qualityVal');

const scalePreset    = $('scalePreset');
const customScaleRow = $('customScaleRow');
const scaleW         = $('scaleW');
const scaleH         = $('scaleH');

const trimStart      = $('trimStart');
const trimEnd        = $('trimEnd');

const folderDisplay  = $('folderDisplay');
const btnPickFolder  = $('btnPickFolder');

const estimateBar    = $('estimateBar');
const estimateText   = $('estimateText');

const btnStart       = $('btnStart');
const progressWrap   = $('progressWrap');
const progressFill   = $('progressFill');
const progressMeta   = $('progressMeta');
const btnCancel      = $('btnCancel');

const resultCard     = $('resultCard');
const resultInfo     = $('resultInfo');
const btnReveal      = $('btnReveal');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes > 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
  if (bytes > 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
  return (bytes / 1e3).toFixed(0) + ' KB';
}

function formatDuration(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toFixed(2);
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(5,'0')}`
    : `${m}:${String(sec).padStart(5,'0')}`;
}

function qualityLabel(v) {
  const labels = { 1: 'Max', 2: 'High', 3: 'Good', 4: 'Normal', 5: 'Medium',
                   6: 'Fair', 7: 'Low', 8: 'Poor', 9: 'Min' };
  return labels[v] ?? v;
}

function generateJobId() {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function setReady() {
  const ok = state.videoPath && state.outputFolder && state.fps;
  btnStart.disabled = !ok;

  if (ok) updateEstimate();
  else {
    estimateBar.hidden = true;
  }
}

function updateEstimate() {
  const info = state._videoInfo;
  if (!info) return;

  const duration = (state.trimEnd || info.duration) - (state.trimStart || 0);
  const estimated = Math.round(duration * state.fps);
  estimateBar.hidden = false;
  estimateText.textContent =
    `≈ ${estimated.toLocaleString()} frames  ·  ${duration.toFixed(1)}s @ ${state.fps} fps`;
}

// ─── Video loading ────────────────────────────────────────────────────────────
async function loadVideo(filePath) {
  state.videoPath = filePath;

  let info;
  try {
    info = await window.electronAPI.getVideoInfo(filePath);
  } catch (err) {
    alert('Could not read video metadata: ' + err);
    return;
  }
  state._videoInfo = info;

  // Thumbnail via <video> element
  videoThumb.innerHTML = `<video src="${filePath}" muted></video>`;

  // Metadata grid
  videoMeta.innerHTML = `
    <div class="meta-row"><span class="meta-key">File</span><span class="meta-val">${info.filename}</span></div>
    <div class="meta-row"><span class="meta-key">Resolution</span><span class="meta-val">${info.width}×${info.height}</span></div>
    <div class="meta-row"><span class="meta-key">Duration</span><span class="meta-val">${formatDuration(info.duration)}</span></div>
    <div class="meta-row"><span class="meta-key">Native FPS</span><span class="meta-val">${info.fps}</span></div>
    <div class="meta-row"><span class="meta-key">Codec</span><span class="meta-val">${info.codec.toUpperCase()}</span></div>
    <div class="meta-row"><span class="meta-key">Size</span><span class="meta-val">${formatBytes(info.size)}</span></div>
  `;

  dropZone.hidden = true;
  videoCard.hidden = false;
  setReady();
}

function clearVideo() {
  state.videoPath   = null;
  state._videoInfo  = null;
  dropZone.hidden   = false;
  videoCard.hidden  = true;
  estimateBar.hidden = true;
  resultCard.hidden  = true;
  btnStart.disabled  = true;
}

// ─── Drop zone ────────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) await loadVideo(file.path);
});

dropZone.addEventListener('click', () => btnPickVideo.click());

btnPickVideo.addEventListener('click', async () => {
  const filePath = await window.electronAPI.pickVideo();
  if (filePath) await loadVideo(filePath);
});

btnClearVideo.addEventListener('click', clearVideo);

// ─── FPS presets ──────────────────────────────────────────────────────────────
fpsPresets.addEventListener('click', e => {
  const btn = e.target.closest('.fps-btn');
  if (!btn) return;

  fpsPresets.querySelectorAll('.fps-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (btn.dataset.fps === 'custom') {
    customFpsRow.hidden = false;
    state.fps = parseFloat(customFpsInput.value) || null;
  } else {
    customFpsRow.hidden = true;
    state.fps = parseFloat(btn.dataset.fps);
  }
  setReady();
});

customFpsInput.addEventListener('input', () => {
  state.fps = parseFloat(customFpsInput.value) || null;
  setReady();
});

// ─── Format ───────────────────────────────────────────────────────────────────
fmtGroup.addEventListener('change', e => {
  state.format = e.target.value;
});

// ─── Quality slider ───────────────────────────────────────────────────────────
qualitySlider.addEventListener('input', () => {
  state.quality = parseInt(qualitySlider.value);
  qualityVal.textContent = qualityLabel(state.quality);
});

// ─── Scale ────────────────────────────────────────────────────────────────────
scalePreset.addEventListener('change', () => {
  const v = scalePreset.value;
  if (v === 'custom') {
    customScaleRow.hidden = false;
    state.scale = null;
  } else {
    customScaleRow.hidden = true;
    state.scale = v || null;
  }
  setReady();
});

[scaleW, scaleH].forEach(el => {
  el.addEventListener('input', () => {
    const w = scaleW.value;
    const h = scaleH.value;
    state.scale = (w && h) ? `${w}:${h}` : null;
    setReady();
  });
});

// ─── Trim ─────────────────────────────────────────────────────────────────────
trimStart.addEventListener('input', () => {
  state.trimStart = trimStart.value !== '' ? parseFloat(trimStart.value) : null;
  setReady();
});
trimEnd.addEventListener('input', () => {
  state.trimEnd = trimEnd.value !== '' ? parseFloat(trimEnd.value) : null;
  setReady();
});

// ─── Output folder ────────────────────────────────────────────────────────────
btnPickFolder.addEventListener('click', async () => {
  const folder = await window.electronAPI.pickOutputFolder();
  if (folder) {
    state.outputFolder = folder;
    folderDisplay.textContent = folder;
    folderDisplay.title = folder;
    setReady();
  }
});

// ─── Extraction ───────────────────────────────────────────────────────────────
btnStart.addEventListener('click', async () => {
  if (!state.videoPath || !state.outputFolder || !state.fps) return;

  const jobId = generateJobId();
  state.activeJobId = jobId;

  // UI: show progress
  progressWrap.hidden = false;
  resultCard.hidden   = true;
  progressFill.style.width = '0%';
  progressMeta.textContent = 'Starting FFmpeg…';
  btnStart.disabled = true;
  btnStart.querySelector('.btn-label').textContent = 'Extracting…';

  // Register event listener
  if (state.cleanupEvent) state.cleanupEvent();
  state.cleanupEvent = window.electronAPI.onJobEvent(handleJobEvent);

  try {
    await window.electronAPI.startExtraction({
      jobId,
      videoPath:    state.videoPath,
      outputFolder: state.outputFolder,
      fps:          state.fps,
      format:       state.format,
      quality:      state.quality,
      scale:        state.scale,
      startTime:    state.trimStart,
      endTime:      state.trimEnd,
    });
  } catch (err) {
    progressMeta.textContent = '⚠ Error: ' + err;
    btnStart.disabled = false;
    btnStart.querySelector('.btn-label').textContent = 'Extract Frames';
  }
});

btnCancel.addEventListener('click', async () => {
  if (state.activeJobId) {
    await window.electronAPI.cancelJob(state.activeJobId);
    state.activeJobId = null;
  }
  progressWrap.hidden = true;
  btnStart.disabled = false;
  btnStart.querySelector('.btn-label').textContent = 'Extract Frames';
});

// ─── Job event handler ────────────────────────────────────────────────────────
function handleJobEvent(data) {
  if (data.jobId !== state.activeJobId) return;

  switch (data.type) {
    case 'start':
      progressMeta.textContent = 'Processing…';
      break;

    case 'progress': {
      const pct = Math.min(data.percent ?? 0, 100);
      progressFill.style.width = pct + '%';
      progressMeta.textContent =
        `${pct.toFixed(1)}%  ·  ${data.frames} frames  ·  ${data.timemark ?? ''}`;
      break;
    }

    case 'done': {
      progressWrap.hidden = true;
      resultCard.hidden = false;
      resultInfo.innerHTML =
        `<strong>${data.frameCount.toLocaleString()} frames</strong> extracted<br />
         <span style="font-size:10px;word-break:break-all">${data.outDir}</span>`;
      state._lastOutDir = data.outDir;
      state.activeJobId = null;
      btnStart.disabled = false;
      btnStart.querySelector('.btn-label').textContent = 'Extract Frames';
      break;
    }

    case 'error':
      progressMeta.textContent = '⚠ ' + data.message;
      state.activeJobId = null;
      btnStart.disabled = false;
      btnStart.querySelector('.btn-label').textContent = 'Extract Frames';
      break;
  }
}

btnReveal.addEventListener('click', () => {
  if (state._lastOutDir) window.electronAPI.revealFolder(state._lastOutDir);
});

// ─── Init ─────────────────────────────────────────────────────────────────────
setReady();
