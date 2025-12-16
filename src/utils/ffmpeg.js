import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let loaded = false;

export async function initFFmpeg(onProgress) {
  if (loaded) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  
  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) {
      onProgress(Math.round(progress * 100));
    }
  });
  
  // Load FFmpeg WASM
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  loaded = true;
  return ffmpeg;
}

export async function processVideo(file, options, onProgress) {
  const {
    cropX = 0,
    cropY = 0,
    cropWidth = null,
    cropHeight = null,
    speed = 1,
    trimStart = 0,
    trimEnd = null,
  } = options;
  
  const ff = await initFFmpeg(onProgress);
  
  // Write input file
  const inputName = 'input' + getExtension(file.name);
  const outputName = 'output.mp4';
  
  await ff.writeFile(inputName, await fetchFile(file));
  
  // Build FFmpeg command
  const filters = [];
  const args = ['-i', inputName];
  
  // Trim
  if (trimStart > 0) {
    args.push('-ss', String(trimStart));
  }
  if (trimEnd !== null) {
    args.push('-t', String(trimEnd - trimStart));
  }
  
  // Speed
  if (speed !== 1) {
    // Video speed: setpts=PTS/speed
    // Audio speed: atempo (only supports 0.5 to 2.0, chain for more)
    const videoFilter = `setpts=${(1/speed).toFixed(4)}*PTS`;
    let audioFilter = '';
    
    if (speed >= 0.5 && speed <= 2.0) {
      audioFilter = `atempo=${speed}`;
    } else if (speed > 2.0) {
      // Chain atempo filters for speeds > 2
      const atempoCount = Math.ceil(Math.log(speed) / Math.log(2));
      const atempoFilters = [];
      let remainingSpeed = speed;
      for (let i = 0; i < atempoCount; i++) {
        const thisSpeed = Math.min(2.0, remainingSpeed);
        atempoFilters.push(`atempo=${thisSpeed}`);
        remainingSpeed /= thisSpeed;
      }
      audioFilter = atempoFilters.join(',');
    } else {
      // Chain atempo filters for speeds < 0.5
      const atempoCount = Math.ceil(Math.log(1/speed) / Math.log(2));
      const atempoFilters = [];
      let remainingSpeed = speed;
      for (let i = 0; i < atempoCount; i++) {
        const thisSpeed = Math.max(0.5, remainingSpeed);
        atempoFilters.push(`atempo=${thisSpeed}`);
        remainingSpeed /= thisSpeed;
      }
      audioFilter = atempoFilters.join(',');
    }
    
    filters.push({ video: videoFilter, audio: audioFilter });
  }
  
  // Crop
  if (cropWidth && cropHeight) {
    const cropFilter = `crop=${Math.round(cropWidth)}:${Math.round(cropHeight)}:${Math.round(cropX)}:${Math.round(cropY)}`;
    filters.push({ video: cropFilter });
  }
  
  // Build filter complex
  if (filters.length > 0) {
    const videoFilters = filters.map(f => f.video).filter(Boolean).join(',');
    const audioFilters = filters.map(f => f.audio).filter(Boolean).join(',');
    
    if (videoFilters && audioFilters) {
      args.push('-filter_complex', `[0:v]${videoFilters}[v];[0:a]${audioFilters}[a]`);
      args.push('-map', '[v]', '-map', '[a]');
    } else if (videoFilters) {
      args.push('-vf', videoFilters);
    } else if (audioFilters) {
      args.push('-af', audioFilters);
    }
  }
  
  // Output settings
  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'aac',
    '-b:a', '128k',
    outputName
  );
  
  console.log('FFmpeg args:', args.join(' '));
  
  await ff.exec(args);
  
  // Read output file
  const data = await ff.readFile(outputName);
  
  // Cleanup
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);
  
  return new Blob([data.buffer], { type: 'video/mp4' });
}

function getExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return '.' + ext;
}

export function isFFmpegLoaded() {
  return loaded;
}
