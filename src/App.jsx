import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoUpload } from './components/VideoUpload';
import { VideoPreview } from './components/VideoPreview';
import { Timeline } from './components/Timeline';
import { CropControls } from './components/CropControls';
import { SpeedControls } from './components/SpeedControls';
import { ExportButton } from './components/ExportButton';
import { generateThumbnails } from './utils/thumbnails';
import './index.css';

function App() {
  // Video state
  const [videoFile, setVideoFile] = useState(null);
  const [videoMeta, setVideoMeta] = useState({ duration: 0, width: 0, height: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [thumbnails, setThumbnails] = useState([]);

  // Edit state
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [selectedRatio, setSelectedRatio] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const videoRef = useRef(null);

  // Handle video load
  const handleVideoLoad = useCallback(async (file) => {
    setVideoFile(file);
    setIsPlaying(false);
    setCurrentTime(0);
    setSpeed(1);
    setSelectedRatio(null);

    // Generate thumbnails
    try {
      const thumbs = await generateThumbnails(file, 15);
      setThumbnails(thumbs);
    } catch (err) {
      console.error('Failed to generate thumbnails:', err);
      setThumbnails([]);
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

  // Handle video metadata loaded
  const handleLoadedMetadata = useCallback((meta) => {
    setVideoMeta(meta);
    setCropArea({
      x: 0,
      y: 0,
      width: meta.width,
      height: meta.height
    });
    setTrimStart(0);
    setTrimEnd(meta.duration);
  }, []);

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

  // Handle time update
  const handleTimeUpdate = useCallback((time) => {
    setCurrentTime(time);

    if (time >= trimEnd && isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [trimEnd, isPlaying]);

  // Handle seek
  const handleSeek = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Handle trim change
  const handleTrimChange = useCallback((start, end) => {
    setTrimStart(start);
    setTrimEnd(end);

    if (videoRef.current) {
      if (videoRef.current.currentTime < start) {
        videoRef.current.currentTime = start;
      } else if (videoRef.current.currentTime > end) {
        videoRef.current.currentTime = end;
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
      {/* Header - minimal, no logo */}
      <header className="header">
        <div className="header__title">
          {videoFile ? videoFile.name : ''}
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
            <VideoUpload onVideoLoad={handleVideoLoad} />
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
      {videoFile && (
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
