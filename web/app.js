// Import FFmpeg Core Libraries via ES Modules from unpkg CDN
import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.2/dist/esm/index.js';
// Import JSZip as a global
import 'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js';

// --- State Variables ---
let ffmpeg = null;
let currentFile = null;
let videoDuration = 0;
let isProcessing = false;

// --- DOM Nodes ---
const dropZone = document.getElementById('dropZone');
const videoInput = document.getElementById('videoInput');
const videoCard = document.getElementById('videoCard');
const videoThumb = document.getElementById('videoThumb');
const videoMeta = document.getElementById('videoMeta');
const btnClearVideo = document.getElementById('btnClearVideo');

const fpsPresets = document.getElementById('fpsPresets');
const fpsBtns = fpsPresets.querySelectorAll('.fps-btn');
const customFpsRow = document.getElementById('customFpsRow');
const customFpsInput = document.getElementById('customFpsInput');

const fmtGroup = document.getElementById('fmtGroup');
const qualitySlider = document.getElementById('qualitySlider');
const qualityVal = document.getElementById('qualityVal');

const trimStart = document.getElementById('trimStart');
const trimEnd = document.getElementById('trimEnd');

const estimateBar = document.getElementById('estimateBar');
const estimateText = document.getElementById('estimateText');
const btnStart = document.getElementById('btnStart');
const btnLabel = document.getElementById('btnLabel');

const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressMeta = document.getElementById('progressMeta');
const btnCancel = document.getElementById('btnCancel');

const resultCard = document.getElementById('resultCard');
const resultInfo = document.getElementById('resultInfo');
const btnReveal = document.getElementById('btnReveal');
const pwaInstallContainer = document.getElementById('pwaInstallContainer');

// --- Register Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('SW Registered', r.scope))
      .catch(err => console.error('SW Error', err));
  });
}

// --- PWA Installation Logic ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  pwaInstallContainer.hidden = false;
});
document.getElementById('btnInstallPwa').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') pwaInstallContainer.hidden = true;
    deferredPrompt = null;
  }
});

// --- UI EVENT LISTENERS ---

// File Selection
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFileSelected(e.dataTransfer.files[0]);
  }
});
videoInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handleFileSelected(e.target.files[0]);
});

// Clear Selection
btnClearVideo.addEventListener('click', () => {
  currentFile = null;
  videoDuration = 0;
  videoCard.hidden = true;
  dropZone.style.display = 'flex';
  btnStart.disabled = true;
  estimateBar.hidden = true;
  resultCard.hidden = true;
});

// FPS Toggle
fpsBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    fpsBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    
    if (e.target.dataset.fps === 'custom') {
      customFpsRow.hidden = false;
    } else {
      customFpsRow.hidden = true;
    }
    updateEstimate();
  });
});
customFpsInput.addEventListener('input', updateEstimate);

// Quality Slider Text
qualitySlider.addEventListener('input', (e) => {
  const val = e.target.value;
  if(val < 3) qualityVal.innerText = 'High';
  else if(val < 6) qualityVal.innerText = 'Medium';
  else qualityVal.innerText = 'Low (Small Size)';
});

// Trim Update
trimStart.addEventListener('input', updateEstimate);
trimEnd.addEventListener('input', updateEstimate);

// --- HELPER LOGIC ---

function handleFileSelected(file) {
  if (!file.type.startsWith('video/')) {
    alert('Please select a valid video file.');
    return;
  }
  currentFile = file;
  
  // Create quick browser video parser to get duration 
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.src = url;
  
  v.onloadedmetadata = () => {
    videoDuration = v.duration;
    
    // Set thumbnail to ~1s mark
    v.currentTime = Math.min(1, videoDuration / 2);
  };
  
  v.onseeked = () => {
    // Generate Canvas Thumb
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    videoThumb.style.backgroundImage = `url(${canvas.toDataURL('image/jpeg')})`;
    
    // Cleanup URL
    URL.revokeObjectURL(url);
    
    let sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    videoMeta.innerHTML = `<strong>${file.name}</strong><br/>${sizeMB} MB &nbsp;•&nbsp; ${v.videoWidth}x${v.videoHeight} &nbsp;•&nbsp; ${formatDuration(videoDuration)}`;
    
    trimStart.max = videoDuration.toFixed(1);
    trimEnd.max = videoDuration.toFixed(1);
    
    dropZone.style.display = 'none';
    videoCard.hidden = false;
    btnStart.disabled = false;
    estimateBar.hidden = false;
    resultCard.hidden = true;
    updateEstimate();
  };
}

function getSelectedFps() {
  const activeBtn = Array.from(fpsBtns).find(b => b.classList.contains('active'));
  // Enforce Max 30 FPS Cap for Free Web Version
  const selectedFps = activeBtn ? parseFloat(activeBtn.dataset.fps) : 30;
  return Math.min(selectedFps, 30);
}

function updateEstimate() {
  if (!currentFile || !videoDuration) return;
  const fps = getSelectedFps();
  let start = Math.max(0, parseFloat(trimStart.value) || 0);
  let end = Math.min(videoDuration, parseFloat(trimEnd.value) || videoDuration);
  if (start >= end) {
      estimateText.innerText = `Invalid trim settings.`;
      btnStart.disabled = true;
      return;
  }
  
  btnStart.disabled = false;
  const durToProcess = end - start;
  const estFrames = Math.floor(durToProcess * fps);
  estimateText.innerText = `~${estFrames} frames estimated based on settings`;
}

function formatDuration(sec) {
  const d = new Date(sec * 1000);
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${min}:${s}`;
}

// --- FFMPEG CORE EXTRACTION ENGINE ---

async function loadFFmpeg() {
  if (!ffmpeg) {
    progressMeta.innerText = "Loading FFmpeg Engine (~25MB)...";
    ffmpeg = new FFmpeg();
    ffmpeg.on('log', ({ message }) => console.log('[ffmpeg log]', message));
    
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      // Important to skip web worker inside service worker contexts for pure PWA robustness
    });
  }
}

btnStart.addEventListener('click', async () => {
    if(!currentFile) return;
    
    if (!window.crossOriginIsolated) {
        alert("Cross-Origin Isolation not detected. The browser might block FFmpeg. Try using localhost or enabling HTTPS.");
    }
    
    isProcessing = true;
    btnStart.disabled = true;
    btnClearVideo.disabled = true;
    progressWrap.hidden = false;
    resultCard.hidden = true;
    progressFill.style.width = '0%';
    
    try {
        await loadFFmpeg();
        
        progressMeta.innerText = "Writing video securely to browser memory...";
        const inputName = 'input_video.mp4';
        await ffmpeg.writeFile(inputName, await fetchFile(currentFile));
        
        // Grab Params
        const fps = getSelectedFps();
        const fmtElement = document.querySelector('input[name="fmt"]:checked');
        const format = fmtElement ? fmtElement.value : 'png';
        const q = qualitySlider.value;
        const qFlag = format === 'jpg' ? ['-q:v', q] : [];
        
        let start = parseFloat(trimStart.value) || 0;
        let end = parseFloat(trimEnd.value) || videoDuration;
        
        // Prep Progress Tracking
        const durToProcess = end - start;
        const totalFrames = Math.max(1, Math.floor(durToProcess * fps));
        let framesExtracted = 0;
        
        ffmpeg.on('progress', ({ progress, time }) => {
            const pct = Math.min(100, Math.max(0, progress * 100));
            progressFill.style.width = `${pct}%`;
            progressMeta.innerText = `Extracting frames... ${Math.round(pct)}%`;
        });
        
        const outPattern = `thumb_%06d.${format}`;
        
        const cmd = [
            '-ss', String(start),
            '-t', String(durToProcess),
            '-i', inputName,
            '-r', String(fps),
            ...qFlag,
            outPattern
        ];
        
        progressMeta.innerText = "Processing video geometry...";
        console.log("EXEC", cmd);
        
        await ffmpeg.exec(cmd);
        
        progressMeta.innerText = "Packaging memory into ZIP archive...";
        
        // READ output files from virtual memory and create ZIP
        const dirList = await ffmpeg.listDir('/');
        const outputFiles = dirList.filter(f => f.name.startsWith('thumb_') && f.name.endsWith(`.${format}`));
        
        const zip = new JSZip();
        for(let f of outputFiles) {
            const data = await ffmpeg.readFile(f.name);
            zip.file(f.name, data);
            
            // Clean up emscripten memeory
            ffmpeg.deleteFile(f.name);
        }
        ffmpeg.deleteFile(inputName);
        
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: "STORE" });
        const zipUrl = URL.createObjectURL(zipBlob);
        
        // FINISHED!
        isProcessing = false;
        progressWrap.hidden = true;
        resultCard.hidden = false;
        
        resultInfo.innerHTML = `<strong>Success!</strong><br/>Extracted ${outputFiles.length} frames into a downloadable ZIP.`;
        
        // Assign the download functionality to the result button
        btnReveal.href = zipUrl;
        btnReveal.download = `Extracted_Frames_${currentFile.name}.zip`;
        
        btnStart.disabled = false;
        btnClearVideo.disabled = false;
        
    } catch(err) {
        console.error(err);
        isProcessing = false;
        btnStart.disabled = false;
        btnClearVideo.disabled = false;
        progressWrap.hidden = true;
        alert("Extraction failed. Out of memory? Check console for details.");
    }
});

btnCancel.addEventListener('click', () => {
    if(ffmpeg && isProcessing) {
        // Soft force terminate ffmpeg processing
        ffmpeg.terminate();
        ffmpeg = null; 
        isProcessing = false;
        
        progressWrap.hidden = true;
        btnStart.disabled = false;
        btnClearVideo.disabled = false;
        alert("Engine operation was cancelled.");
    }
});
