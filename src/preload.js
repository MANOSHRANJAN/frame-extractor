// src/preload.js  —  Context-isolated bridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── File / folder pickers ─────────────────────────────────────────────────
  pickVideo:        ()           => ipcRenderer.invoke('pick-video'),
  pickOutputFolder: ()           => ipcRenderer.invoke('pick-output-folder'),

  // ── Video metadata ────────────────────────────────────────────────────────
  getVideoInfo: (videoPath)      => ipcRenderer.invoke('get-video-info', videoPath),

  // ── Extraction control ────────────────────────────────────────────────────
  startExtraction: (opts)        => ipcRenderer.invoke('start-extraction', opts),
  cancelJob:       (jobId)       => ipcRenderer.invoke('cancel-job', jobId),

  // ── Shell ─────────────────────────────────────────────────────────────────
  revealFolder: (folderPath)     => ipcRenderer.invoke('reveal-folder', folderPath),

  // ── Listen for progress events pushed from main ───────────────────────────
  onJobEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('job-event', handler);
    // Return a cleanup function
    return () => ipcRenderer.removeListener('job-event', handler);
  },
});
