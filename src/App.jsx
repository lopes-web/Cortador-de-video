import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoUpload } from './components/VideoUpload';
import { VideoPreview } from './components/VideoPreview';
import { Timeline } from './components/Timeline';
import { CropControls } from './components/CropControls';
import { SpeedControls } from './components/SpeedControls';
import { ExportButton } from './components/ExportButton';
import { generateThumbnails, generateThumbnailsFromVideo } from './utils/thumbnails';
import './index.css';

function App() {
  // Video state
  const [videoFile, setVideoFile] = useState(null);
  const [videoMeta, setVideoMeta] = useState({ duration: 0, width: 0, height: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [thumbnails, setThumbnails] = useState([]);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef(null);

  // Edit state
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [selectedRatio, setSelectedRatio] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const videoRef = useRef(null);

  // Format recording time
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Recording handlers
  const handleRecordingStart = useCallback(() => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
  }, []);

  const handleRecordingEnd = useCallback(() => {
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  }, []);

  const handleStopRecording = () => {
    console.log('handleStopRecording called, window.stopScreenRecording:', !!window.stopScreenRecording);
    if (window.stopScreenRecording) {
      window.stopScreenRecording();
    } else {
      console.error('stopScreenRecording not found on window');
    }
  };

  // Handle video load - accepts optional known duration for screen recordings
  const handleVideoLoad = useCallback(async (file, knownDuration = null) => {
    console.log('handleVideoLoad called, knownDuration:', knownDuration);

    setVideoFile(file);
    setIsPlaying(false);
    setCurrentTime(0);
    setSpeed(1);
    setSelectedRatio(null);
    setThumbnails([]);

    // Check if this is a screen recording
    const isScreenRecording = file.type === 'video/webm' && file.name.startsWith('gravacao_');

    // If we have a known duration (from screen recording), set it immediately
    if (knownDuration && knownDuration > 0) {
      console.log('Setting known duration:', knownDuration);
      window._knownVideoDuration = knownDuration;

      // Set video meta with known duration immediately (will be updated with dimensions later)
      setVideoMeta(prev => ({ ...prev, duration: knownDuration }));
      setTrimStart(0);
      setTrimEnd(knownDuration);
    } else {
      window._knownVideoDuration = null;
    }

    // Skip thumbnail generation for screen recordings to avoid errors
    if (!isScreenRecording) {
      try {
        const thumbs = await generateThumbnails(file, 15);
        setThumbnails(thumbs);
      } catch (err) {
        console.warn('Failed to generate thumbnails:', err);
        setThumbnails([]);
      }
    }
  }, []);

  // Handle new video
  const handleNewVideo = () => {
    setVideoFile(null);
    setVideoMeta({ duration: 0, width: 0, height: 0 });
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    setThumbnails([]);
    setCurrentTime(0);
    setSpeed(1);
    setTrimStart(0);
    setTrimEnd(0);
  };

  // Handle video metadata loaded - use known duration for screen recordings
  const handleLoadedMetadata = useCallback((meta) => {
    console.log('handleLoadedMetadata called, meta:', meta, 'known:', window._knownVideoDuration, 'current:', videoMeta.duration);

    // Use known duration from screen recording if available
    let duration = window._knownVideoDuration;

    // If no known duration, check if we already have a valid duration set
    if (!duration || duration <= 0) {
      if (videoMeta.duration > 0) {
        // Keep existing duration (was set by handleVideoLoad)
        duration = videoMeta.duration;
      } else {
        // Try to get from video (may be Infinity for WebM)
        duration = meta.duration;
        if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
          duration = 0;
        }
      }
    }

    console.log('handleLoadedMetadata setting duration:', duration);

    setVideoMeta({
      ...meta,
      duration
    });
    setCropArea({
      x: 0,
      y: 0,
      width: meta.width,
      height: meta.height
    });
    setTrimStart(0);
    setTrimEnd(duration);

    // Clear known duration after use
    window._knownVideoDuration = null;
  }, [videoMeta.duration]);

  // Update duration when it becomes available
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoFile) return;

    const updateDuration = () => {
      if (isFinite(video.duration) && video.duration > 0 && videoMeta.duration === 0) {
        setVideoMeta(prev => ({ ...prev, duration: video.duration }));
        setTrimEnd(video.duration);
      }
    };

    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('canplaythrough', updateDuration);
    video.addEventListener('timeupdate', updateDuration);

    return () => {
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('canplaythrough', updateDuration);
      video.removeEventListener('timeupdate', updateDuration);
    };
  }, [videoFile, videoMeta.duration]);

  // Generate thumbnails for screen recordings after video is ready
  useEffect(() => {
    const video = videoRef.current;
    const isScreenRecording = videoFile?.type === 'video/webm' && videoFile?.name?.startsWith('gravacao_');

    // Only for screen recordings that don't have thumbnails yet
    if (!video || !isScreenRecording || thumbnails.length > 0 || videoMeta.duration <= 0) {
      return;
    }

    const generateRecordingThumbnails = async () => {
      // Wait for video to be ready
      if (video.readyState >= 2 && video.videoWidth > 0) {
        console.log('Generating thumbnails for screen recording...');
        const thumbs = await generateThumbnailsFromVideo(video, videoMeta.duration, 15);
        if (thumbs.length > 0) {
          console.log('Generated', thumbs.length, 'thumbnails');
          setThumbnails(thumbs);
        }
      }
    };

    // Try immediately
    generateRecordingThumbnails();

    // Also try on canplay
    const onCanPlay = () => generateRecordingThumbnails();
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [videoFile, videoMeta.duration, thumbnails.length]);

  // Play/Pause
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, trimStart, trimEnd]);

  // Apply playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  // Handle time update - enforce trim limits
  const handleTimeUpdate = useCallback((time) => {
    // Clamp time within trim bounds
    if (time >= trimEnd) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = trimEnd;
      }
      setCurrentTime(trimEnd);
      setIsPlaying(false);
      return;
    }

    if (time < trimStart) {
      if (videoRef.current) {
        videoRef.current.currentTime = trimStart;
      }
      setCurrentTime(trimStart);
      return;
    }

    setCurrentTime(time);
  }, [trimStart, trimEnd]);

  // Handle seek - limit to trim range
  const handleSeek = useCallback((time) => {
    if (videoRef.current) {
      // Clamp time to trim range
      const clampedTime = Math.max(trimStart, Math.min(trimEnd, time));
      videoRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  }, [trimStart, trimEnd]);

  // Handle trim change
  const handleTrimChange = useCallback((start, end) => {
    setTrimStart(start);
    setTrimEnd(end);

    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      if (current < start) {
        videoRef.current.currentTime = start;
        setCurrentTime(start);
      } else if (current > end) {
        videoRef.current.currentTime = end;
        setCurrentTime(end);
      }
    }
  }, []);

  // Handle video ended
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [videoFile]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && videoFile) {
        e.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoFile, handlePlayPause]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header__left">
          {isRecording && (
            <div className="recording-indicator">
              <span className="recording-indicator__dot" />
              <span className="recording-indicator__time">{formatRecordingTime(recordingTime)}</span>
              <button className="recording-indicator__stop" onClick={handleStopRecording}>
                Parar
              </button>
            </div>
          )}
          {!isRecording && (
            <div className="header__title">
              {videoFile ? videoFile.name : 'Cortador de vídeo'}
            </div>
          )}
        </div>

        <div className="header__controls">
          {videoFile && (
            <>
              <SpeedControls speed={speed} onSpeedChange={setSpeed} />
              <button className="new-video-btn" onClick={handleNewVideo}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Novo
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="preview-area">
          {!videoFile ? (
            <VideoUpload
              onVideoLoad={handleVideoLoad}
              isRecording={isRecording}
              onRecordingStart={handleRecordingStart}
              onRecordingEnd={handleRecordingEnd}
            />
          ) : (
            <VideoPreview
              videoFile={videoFile}
              videoRef={videoRef}
              cropArea={cropArea}
              onCropChange={setCropArea}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
            />
          )}
        </div>
      </main>

      {/* Timeline */}
      {videoFile && videoMeta.duration > 0 && (
        <Timeline
          duration={videoMeta.duration}
          currentTime={currentTime}
          trimStart={trimStart}
          trimEnd={trimEnd}
          thumbnails={thumbnails}
          onTrimChange={handleTrimChange}
          onSeek={handleSeek}
        />
      )}

      {/* Controls Bar */}
      {videoFile && (
        <div className="controls-bar">
          <div className="controls-bar__left">
            <button className="play-btn" onClick={handlePlayPause}>
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,3 20,12 6,21" />
                </svg>
              )}
            </button>

            <span className="hint-text">
              <kbd>Alt</kbd> mantém proporção
            </span>
          </div>

          <div className="controls-bar__center">
            <CropControls
              cropArea={cropArea}
              videoWidth={videoMeta.width}
              videoHeight={videoMeta.height}
              onCropChange={setCropArea}
              selectedRatio={selectedRatio}
              onRatioChange={setSelectedRatio}
            />
          </div>

          <div className="controls-bar__right">
            <ExportButton
              videoFile={videoFile}
              cropArea={cropArea}
              speed={speed}
              trimStart={trimStart}
              trimEnd={trimEnd}
              disabled={!videoFile}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
