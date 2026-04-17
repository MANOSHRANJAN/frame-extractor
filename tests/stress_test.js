const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

// Use the bundled FFmpeg binary
const ffmpegPath = path.join(__dirname, 'ffmpeg-bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const videoPath = path.join(__dirname, 'stress_test_video.mp4');
const outputDir = path.join(__dirname, 'stress_output');
fs.mkdirSync(outputDir, { recursive: true });

console.log('🚀 STRESS TEST STARTED');
console.log('====================================');
console.log('Input Video:  10 seconds (1080p, 60fps)');
console.log('Target FPS:   120 fps (Up-sampling heavily)');
console.log('Format:       JPG (Quality 2)');
console.log('Scale:        3840:2160 (Upscaling to 4K)');
console.log('Output:       Up to 1,200 4K images');
console.log('====================================\n');

const startTime = Date.now();
let eventCount = 0;
let lastMem = 0;

ffmpeg(videoPath)
  .videoFilters(['scale=3840:2160', 'fps=120']) // Upscale to 4K and 120fps
  .outputOptions(['-q:v 2'])
  .output(path.join(outputDir, 'frame_%06d.jpg'))
  .on('start', (cmdLine) => {
    console.log('⚡ FFmpeg Command Spawned:');
    console.log(cmdLine);
    console.log('\n⏳ Extracting... Measuring Memory & Speed...');
  })
  .on('progress', (progress) => {
    eventCount++;
    if (eventCount % 10 === 0) { // Log every 10th IPC event to simulate UI load
      const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
      lastMem = Math.max(lastMem, memMB);
      const fps = progress.currentFps || 0;
      process.stdout.write(`\rFrames: ${progress.frames} | Speed: ${fps}fps | Peak RAM: ${lastMem} MB | Time mark: ${progress.timemark}   `);
    }
  })
  .on('end', () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const count = fs.readdirSync(outputDir).filter(f => f.startsWith('frame_')).length;
    
    console.log(`\n\n✅ STRESS TEST COMPLETED SUCCESSFULLY!`);
    console.log(`⏱️  Time taken:   ${elapsed} seconds`);
    console.log(`🖼️  Total extracted: ${count} 4K frames`);
    console.log(`🚀 Avg Extraction Speed: ${Math.round(count / elapsed)} frames / second`);
    console.log(`🧠 Peak Mem Usage: ${lastMem} MB`);
    
    // Cleanup generated large files to save disk space
    fs.rmSync(outputDir, { recursive: true, force: true });
    console.log(`🧹 Cleaned up 4K images (saving several gigabytes).`);
  })
  .on('error', (err) => {
    console.error('\n❌ STRESS TEST FAILED:', err.message);
  })
  .run();
