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

// Quality presets for video
const VIDEO_QUALITY = {
  low: { crf: 28, preset: 'fast' },
  medium: { crf: 23, preset: 'medium' },
  high: { crf: 18, preset: 'slow' },
};

// Quality presets for GIF (fps and scale)
const GIF_QUALITY = {
  low: { fps: 10, scale: 320 },
  medium: { fps: 15, scale: 480 },
  high: { fps: 20, scale: 640 },
};

export async function processVideo(file, options, onProgress) {
  const {
    cropX = 0,
    cropY = 0,
    cropWidth = null,
    cropHeight = null,
    speed = 1,
    trimStart = 0,
    trimEnd = null,
    format = 'mp4', // 'mp4' or 'gif'
    quality = 'medium', // 'low', 'medium', 'high'
  } = options;

  const ff = await initFFmpeg(onProgress);

  // Write input file
  const inputName = 'input' + getExtension(file.name);
  const isGif = format === 'gif';
  const outputName = isGif ? 'output.gif' : 'output.mp4';

  await ff.writeFile(inputName, await fetchFile(file));

  // Build FFmpeg command
  const videoFilters = [];
  const audioFilters = [];
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
    videoFilters.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);

    if (!isGif) {
      // Audio speed adjustment (only for video, not GIF)
      let audioFilter = '';
      if (speed >= 0.5 && speed <= 2.0) {
        audioFilter = `atempo=${speed}`;
      } else if (speed > 2.0) {
        const atempoCount = Math.ceil(Math.log(speed) / Math.log(2));
        const atempoFiltersArr = [];
        let remainingSpeed = speed;
        for (let i = 0; i < atempoCount; i++) {
          const thisSpeed = Math.min(2.0, remainingSpeed);
          atempoFiltersArr.push(`atempo=${thisSpeed}`);
          remainingSpeed /= thisSpeed;
        }
        audioFilter = atempoFiltersArr.join(',');
      } else {
        const atempoCount = Math.ceil(Math.log(1 / speed) / Math.log(2));
        const atempoFiltersArr = [];
        let remainingSpeed = speed;
        for (let i = 0; i < atempoCount; i++) {
          const thisSpeed = Math.max(0.5, remainingSpeed);
          atempoFiltersArr.push(`atempo=${thisSpeed}`);
          remainingSpeed /= thisSpeed;
        }
        audioFilter = atempoFiltersArr.join(',');
      }
      if (audioFilter) {
        audioFilters.push(audioFilter);
      }
    }
  }

  // Crop
  if (cropWidth && cropHeight) {
    videoFilters.push(`crop=${Math.round(cropWidth)}:${Math.round(cropHeight)}:${Math.round(cropX)}:${Math.round(cropY)}`);
  }

  if (isGif) {
    // GIF-specific processing
    const gifSettings = GIF_QUALITY[quality] || GIF_QUALITY.medium;

    // Add fps and scale for GIF
    videoFilters.push(`fps=${gifSettings.fps}`);

    // Scale to max width while maintaining aspect ratio
    if (cropWidth && cropWidth > gifSettings.scale) {
      videoFilters.push(`scale=${gifSettings.scale}:-1:flags=lanczos`);
    } else if (!cropWidth) {
      videoFilters.push(`scale='min(${gifSettings.scale},iw)':-1:flags=lanczos`);
    }

    // Split for palette generation (better quality GIF)
    videoFilters.push('split[s0][s1]');

    // Build filter complex for GIF with palette
    const baseFilters = videoFilters.slice(0, -1).join(','); // All filters except split
    args.push('-filter_complex',
      `${baseFilters},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`
    );

    // GIF output
    args.push('-loop', '0', outputName);

  } else {
    // MP4 processing
    const videoSettings = VIDEO_QUALITY[quality] || VIDEO_QUALITY.medium;

    // Apply video filters
    if (videoFilters.length > 0 || audioFilters.length > 0) {
      if (videoFilters.length > 0 && audioFilters.length > 0) {
        args.push('-filter_complex',
          `[0:v]${videoFilters.join(',')}[v];[0:a]${audioFilters.join(',')}[a]`
        );
        args.push('-map', '[v]', '-map', '[a]');
      } else if (videoFilters.length > 0) {
        args.push('-vf', videoFilters.join(','));
      } else if (audioFilters.length > 0) {
        args.push('-af', audioFilters.join(','));
      }
    }

    // Output settings for MP4
    args.push(
      '-c:v', 'libx264',
      '-preset', videoSettings.preset,
      '-crf', String(videoSettings.crf),
      '-c:a', 'aac',
      '-b:a', '128k',
      outputName
    );
  }

  console.log('FFmpeg args:', args.join(' '));

  await ff.exec(args);

  // Read output file
  const data = await ff.readFile(outputName);

  // Cleanup
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  const mimeType = isGif ? 'image/gif' : 'video/mp4';
  return new Blob([data.buffer], { type: mimeType });
}

function getExtension(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return '.' + ext;
}

export function isFFmpegLoaded() {
  return loaded;
}
