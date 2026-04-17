// src/main.js  —  Electron Main Process
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');

// ─── FFmpeg setup ────────────────────────────────────────────────────────────
// ffmpeg-static ships a pre-built binary for every platform.
// In a packaged app the binary is placed under resources/ffmpeg-bin/;
// during dev it lives inside node_modules.
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch {
  // Fallback: look next to the app binary (packaged build)
  const binName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  ffmpegPath = path.join(process.resourcesPath, 'ffmpeg-bin', binName);
}

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  900,
    height: 700,
    minWidth:  800,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC: Pick a video file ───────────────────────────────────────────────────
ipcMain.handle('pick-video', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select a Video File',
    filters: [
      {
        name: 'Videos',
        extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v', 'ts', 'mts'],
      },
    ],
    properties: ['openFile'],
  });
  return canceled ? null : filePaths[0];
});

// ─── IPC: Pick an output folder ───────────────────────────────────────────────
ipcMain.handle('pick-output-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  return canceled ? null : filePaths[0];
});

// ─── IPC: Get video metadata (duration, resolution, native FPS) ───────────────
ipcMain.handle('get-video-info', async (_event, videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err.message);

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) return reject('No video stream found');

      // Parse "num/den" fraction FPS strings
      const parseFps = (str) => {
        if (!str) return null;
        const [n, d] = str.split('/').map(Number);
        return d ? Math.round((n / d) * 100) / 100 : n;
      };

      resolve({
        duration:    metadata.format.duration,           // seconds
        size:        metadata.format.size,               // bytes
        width:       videoStream.width,
        height:      videoStream.height,
        fps:         parseFps(videoStream.r_frame_rate),
        avgFps:      parseFps(videoStream.avg_frame_rate),
        codec:       videoStream.codec_name,
        filename:    path.basename(videoPath),
      });
    });
  });
});

// ─── Active extraction jobs (keyed by jobId) ─────────────────────────────────
const activeJobs = {};

// ─── IPC: Start frame extraction ─────────────────────────────────────────────
ipcMain.handle('start-extraction', async (_event, opts) => {
  /*
   * opts = {
   *   jobId:        string,
   *   videoPath:    string,
   *   outputFolder: string,
   *   fps:          number,          // target FPS  (e.g. 120, 200, 0.5)
   *   format:       'png'|'jpg'|'webp',
   *   quality:      number,          // 1-31 for jpg, 1-9 for png (lower = better)
   *   scale:        string|null,     // e.g. "1920:1080", null = original
   *   startTime:    number|null,     // trim start (seconds)
   *   endTime:      number|null,     // trim end   (seconds)
   * }
   */
  const {
    jobId, videoPath, outputFolder, fps,
    format = 'png', quality = 2,
    scale = null, startTime = null, endTime = null,
  } = opts;

  // Create a sub-folder named after the video + timestamp
  const videoName  = path.basename(videoPath, path.extname(videoPath));
  const safeLabel  = videoName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const outDir     = path.join(outputFolder, `${safeLabel}_${fps}fps_${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });

  // File name pattern, e.g. frame_00001.png
  const outputPattern = path.join(outDir, `frame_%06d.${format}`);

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(videoPath);

    // Optional trim
    if (startTime !== null) cmd = cmd.seekInput(startTime);
    if (endTime   !== null) cmd = cmd.duration(endTime - (startTime ?? 0));

    // Build filter chain
    const filters = [];
    if (scale)     filters.push(`scale=${scale}`);
    filters.push(`fps=${fps}`);
    if (filters.length) cmd = cmd.videoFilters(filters);

    // Format-specific quality flags
    if (format === 'jpg')  cmd = cmd.outputOptions([`-q:v ${quality}`]);
    if (format === 'png')  cmd = cmd.outputOptions([`-compression_level ${quality}`]);
    if (format === 'webp') cmd = cmd.outputOptions([`-quality ${100 - (quality - 1) * 10}`]);

    cmd
      .output(outputPattern)
      .on('start', (cmdLine) => {
        mainWindow.webContents.send('job-event', {
          jobId, type: 'start', cmdLine,
        });
      })
      .on('progress', (progress) => {
        mainWindow.webContents.send('job-event', {
          jobId, type: 'progress',
          frames:   progress.frames ?? 0,
          percent:  progress.percent ?? 0,
          timemark: progress.timemark,
        });
      })
      .on('end', () => {
        // Count extracted frames
        const count = fs.readdirSync(outDir).filter(f => f.startsWith('frame_')).length;
        delete activeJobs[jobId];
        mainWindow.webContents.send('job-event', {
          jobId, type: 'done', outDir, frameCount: count,
        });
        resolve({ success: true, outDir, frameCount: count });
      })
      .on('error', (err) => {
        delete activeJobs[jobId];
        mainWindow.webContents.send('job-event', {
          jobId, type: 'error', message: err.message,
        });
        reject(err.message);
      })
      .run();

    activeJobs[jobId] = cmd;
  });
});

// ─── IPC: Cancel a running job ────────────────────────────────────────────────
ipcMain.handle('cancel-job', (_event, jobId) => {
  const job = activeJobs[jobId];
  if (job) {
    job.kill('SIGKILL');
    delete activeJobs[jobId];
    return true;
  }
  return false;
});

// ─── IPC: Reveal output folder in Finder / Explorer ──────────────────────────
ipcMain.handle('reveal-folder', (_event, folderPath) => {
  shell.openPath(folderPath);
});
