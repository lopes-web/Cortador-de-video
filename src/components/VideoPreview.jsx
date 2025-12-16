import { useRef, useEffect, useState, useCallback } from 'react';

export function VideoPreview({
    videoFile,
    videoRef,
    cropArea,
    onCropChange,
    isPlaying,
    onPlayPause,
    onTimeUpdate,
    onLoadedMetadata
}) {
    const containerRef = useRef(null);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
    const [videoUrl, setVideoUrl] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragHandle, setDragHandle] = useState(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialCrop, setInitialCrop] = useState(null);
    const [isAltPressed, setIsAltPressed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Create video URL - use data URL for screen recordings to avoid range request errors
    useEffect(() => {
        if (!videoFile) return;

        const isScreenRecording = videoFile.type === 'video/webm' && videoFile.name.startsWith('gravacao_');

        if (isScreenRecording) {
            // For screen recordings, convert to data URL to avoid range request issues
            setIsLoading(true);
            const reader = new FileReader();
            reader.onload = (e) => {
                setVideoUrl(e.target.result);
                setIsLoading(false);
            };
            reader.onerror = () => {
                // Fallback to blob URL if data URL fails
                const url = URL.createObjectURL(videoFile);
                setVideoUrl(url);
                setIsLoading(false);
            };
            reader.readAsDataURL(videoFile);

            return () => {
                reader.abort();
            };
        } else {
            // For regular files, use blob URL
            const url = URL.createObjectURL(videoFile);
            setVideoUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [videoFile]);

    // Track Alt key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Alt') {
                e.preventDefault();
                setIsAltPressed(true);
            }
        };

        const handleKeyUp = (e) => {
            if (e.key === 'Alt') {
                setIsAltPressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Handle metadata and video dimensions
    const updateVideoDimensions = useCallback(() => {
        if (videoRef.current) {
            const video = videoRef.current;
            const rect = video.getBoundingClientRect();

            if (video.videoWidth > 0 && video.videoHeight > 0) {
                setVideoDimensions({
                    width: rect.width,
                    height: rect.height,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                });

                // Only call onLoadedMetadata if we have valid dimensions
                const duration = isFinite(video.duration) && video.duration > 0
                    ? video.duration
                    : 0;

                onLoadedMetadata({
                    duration,
                    width: video.videoWidth,
                    height: video.videoHeight
                });
            }
        }
    }, [onLoadedMetadata]);

    const handleLoadedMetadata = () => {
        updateVideoDimensions();
    };

    // Listen for video events to update dimensions
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !videoUrl) return;

        const handleCanPlay = () => {
            updateVideoDimensions();
        };

        const handleDurationChange = () => {
            updateVideoDimensions();
        };

        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('loadeddata', handleCanPlay);

        return () => {
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('loadeddata', handleCanPlay);
        };
    }, [videoUrl, updateVideoDimensions]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            onTimeUpdate(videoRef.current.currentTime);
        }
    };

    const handleVideoClick = () => {
        onPlayPause();
    };

    // Calculate scale between displayed video and actual video
    const getScale = useCallback(() => {
        if (!videoDimensions.videoWidth) return 1;
        return videoDimensions.width / videoDimensions.videoWidth;
    }, [videoDimensions]);

    // Convert crop area from video coordinates to display coordinates
    const getDisplayCrop = useCallback(() => {
        const scale = getScale();
        return {
            x: cropArea.x * scale,
            y: cropArea.y * scale,
            width: cropArea.width * scale,
            height: cropArea.height * scale
        };
    }, [cropArea, getScale]);

    const handleMouseDown = (e, handle) => {
        e.stopPropagation();
        setIsDragging(true);
        setDragHandle(handle);
        setDragStart({ x: e.clientX, y: e.clientY });
        setInitialCrop({ ...cropArea });
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging || !dragHandle || !initialCrop) return;

        const scale = getScale();
        const dx = (e.clientX - dragStart.x) / scale;
        const dy = (e.clientY - dragStart.y) / scale;

        let newCrop = { ...cropArea };
        const aspectRatio = initialCrop.width / initialCrop.height;

        if (dragHandle === 'move') {
            newCrop.x = Math.max(0, Math.min(videoDimensions.videoWidth - cropArea.width, cropArea.x + dx));
            newCrop.y = Math.max(0, Math.min(videoDimensions.videoHeight - cropArea.height, cropArea.y + dy));
            setDragStart({ x: e.clientX, y: e.clientY });
        } else {
            // Handle resize with optional aspect ratio lock (Alt key)
            const totalDx = (e.clientX - dragStart.x) / scale;
            const totalDy = (e.clientY - dragStart.y) / scale;

            if (dragHandle.includes('e')) {
                newCrop.width = Math.max(50, Math.min(videoDimensions.videoWidth - initialCrop.x, initialCrop.width + totalDx));
                if (isAltPressed) {
                    newCrop.height = newCrop.width / aspectRatio;
                    // Adjust if goes out of bounds
                    if (initialCrop.y + newCrop.height > videoDimensions.videoHeight) {
                        newCrop.height = videoDimensions.videoHeight - initialCrop.y;
                        newCrop.width = newCrop.height * aspectRatio;
                    }
                }
            }

            if (dragHandle.includes('w')) {
                const newWidth = Math.max(50, initialCrop.width - totalDx);
                const newX = initialCrop.x + (initialCrop.width - newWidth);
                if (newX >= 0) {
                    newCrop.width = newWidth;
                    newCrop.x = newX;
                    if (isAltPressed) {
                        const heightChange = (initialCrop.width - newWidth) / aspectRatio;
                        newCrop.height = initialCrop.height - heightChange;
                        newCrop.y = initialCrop.y + heightChange;
                        if (newCrop.y < 0) {
                            newCrop.y = 0;
                            newCrop.height = initialCrop.y + initialCrop.height;
                            newCrop.width = newCrop.height * aspectRatio;
                            newCrop.x = initialCrop.x + initialCrop.width - newCrop.width;
                        }
                    }
                }
            }

            if (dragHandle.includes('s')) {
                newCrop.height = Math.max(50, Math.min(videoDimensions.videoHeight - initialCrop.y, initialCrop.height + totalDy));
                if (isAltPressed) {
                    newCrop.width = newCrop.height * aspectRatio;
                    if (initialCrop.x + newCrop.width > videoDimensions.videoWidth) {
                        newCrop.width = videoDimensions.videoWidth - initialCrop.x;
                        newCrop.height = newCrop.width / aspectRatio;
                    }
                }
            }

            if (dragHandle.includes('n')) {
                const newHeight = Math.max(50, initialCrop.height - totalDy);
                const newY = initialCrop.y + (initialCrop.height - newHeight);
                if (newY >= 0) {
                    newCrop.height = newHeight;
                    newCrop.y = newY;
                    if (isAltPressed) {
                        const widthChange = (initialCrop.height - newHeight) * aspectRatio;
                        newCrop.width = initialCrop.width - widthChange;
                        newCrop.x = initialCrop.x + widthChange;
                        if (newCrop.x < 0) {
                            newCrop.x = 0;
                            newCrop.width = initialCrop.x + initialCrop.width;
                            newCrop.height = newCrop.width / aspectRatio;
                            newCrop.y = initialCrop.y + initialCrop.height - newCrop.height;
                        }
                    }
                }
            }

            // Corner handles with Alt - maintain aspect ratio
            if (isAltPressed && (dragHandle === 'nw' || dragHandle === 'ne' || dragHandle === 'sw' || dragHandle === 'se')) {
                // Use the larger dimension change for proportional resize
                const absX = Math.abs(totalDx);
                const absY = Math.abs(totalDy);

                if (dragHandle === 'se') {
                    if (absX > absY) {
                        newCrop.width = Math.max(50, initialCrop.width + totalDx);
                        newCrop.height = newCrop.width / aspectRatio;
                    } else {
                        newCrop.height = Math.max(50, initialCrop.height + totalDy);
                        newCrop.width = newCrop.height * aspectRatio;
                    }
                    // Bounds check
                    if (initialCrop.x + newCrop.width > videoDimensions.videoWidth) {
                        newCrop.width = videoDimensions.videoWidth - initialCrop.x;
                        newCrop.height = newCrop.width / aspectRatio;
                    }
                    if (initialCrop.y + newCrop.height > videoDimensions.videoHeight) {
                        newCrop.height = videoDimensions.videoHeight - initialCrop.y;
                        newCrop.width = newCrop.height * aspectRatio;
                    }
                }

                if (dragHandle === 'nw') {
                    if (absX > absY) {
                        newCrop.width = Math.max(50, initialCrop.width - totalDx);
                        newCrop.height = newCrop.width / aspectRatio;
                    } else {
                        newCrop.height = Math.max(50, initialCrop.height - totalDy);
                        newCrop.width = newCrop.height * aspectRatio;
                    }
                    newCrop.x = initialCrop.x + initialCrop.width - newCrop.width;
                    newCrop.y = initialCrop.y + initialCrop.height - newCrop.height;
                    // Bounds check
                    if (newCrop.x < 0) {
                        newCrop.x = 0;
                        newCrop.width = initialCrop.x + initialCrop.width;
                        newCrop.height = newCrop.width / aspectRatio;
                        newCrop.y = initialCrop.y + initialCrop.height - newCrop.height;
                    }
                    if (newCrop.y < 0) {
                        newCrop.y = 0;
                        newCrop.height = initialCrop.y + initialCrop.height;
                        newCrop.width = newCrop.height * aspectRatio;
                        newCrop.x = initialCrop.x + initialCrop.width - newCrop.width;
                    }
                }

                if (dragHandle === 'ne') {
                    if (absX > absY) {
                        newCrop.width = Math.max(50, initialCrop.width + totalDx);
                        newCrop.height = newCrop.width / aspectRatio;
                    } else {
                        newCrop.height = Math.max(50, initialCrop.height - totalDy);
                        newCrop.width = newCrop.height * aspectRatio;
                    }
                    newCrop.y = initialCrop.y + initialCrop.height - newCrop.height;
                    // Bounds check
                    if (initialCrop.x + newCrop.width > videoDimensions.videoWidth) {
                        newCrop.width = videoDimensions.videoWidth - initialCrop.x;
                        newCrop.height = newCrop.width / aspectRatio;
                        newCrop.y = initialCrop.y + initialCrop.height - newCrop.height;
                    }
                    if (newCrop.y < 0) {
                        newCrop.y = 0;
                        newCrop.height = initialCrop.y + initialCrop.height;
                        newCrop.width = newCrop.height * aspectRatio;
                    }
                }

                if (dragHandle === 'sw') {
                    if (absX > absY) {
                        newCrop.width = Math.max(50, initialCrop.width - totalDx);
                        newCrop.height = newCrop.width / aspectRatio;
                    } else {
                        newCrop.height = Math.max(50, initialCrop.height + totalDy);
                        newCrop.width = newCrop.height * aspectRatio;
                    }
                    newCrop.x = initialCrop.x + initialCrop.width - newCrop.width;
                    // Bounds check
                    if (newCrop.x < 0) {
                        newCrop.x = 0;
                        newCrop.width = initialCrop.x + initialCrop.width;
                        newCrop.height = newCrop.width / aspectRatio;
                    }
                    if (initialCrop.y + newCrop.height > videoDimensions.videoHeight) {
                        newCrop.height = videoDimensions.videoHeight - initialCrop.y;
                        newCrop.width = newCrop.height * aspectRatio;
                        newCrop.x = initialCrop.x + initialCrop.width - newCrop.width;
                    }
                }
            }
        }

        onCropChange(newCrop);
    }, [isDragging, dragHandle, dragStart, initialCrop, cropArea, videoDimensions, getScale, onCropChange, isAltPressed]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setDragHandle(null);
        setInitialCrop(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const displayCrop = getDisplayCrop();

    return (
        <div className="video-preview" ref={containerRef}>
            <div className="video-preview__container">
                <video
                    ref={videoRef}
                    className="video-preview__video"
                    src={videoUrl}
                    onLoadedMetadata={handleLoadedMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onClick={handleVideoClick}
                    playsInline
                />

                {videoDimensions.width > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: videoDimensions.width,
                            height: videoDimensions.height,
                            pointerEvents: 'none'
                        }}
                    >
                        {/* Crop box - no dark overlay, just the border */}
                        <div
                            className="crop-box"
                            style={{
                                left: displayCrop.x,
                                top: displayCrop.y,
                                width: displayCrop.width,
                                height: displayCrop.height,
                                pointerEvents: 'auto'
                            }}
                            onMouseDown={(e) => handleMouseDown(e, 'move')}
                        >
                            <div className="crop-box__handle crop-box__handle--nw" onMouseDown={(e) => handleMouseDown(e, 'nw')} />
                            <div className="crop-box__handle crop-box__handle--n" onMouseDown={(e) => handleMouseDown(e, 'n')} />
                            <div className="crop-box__handle crop-box__handle--ne" onMouseDown={(e) => handleMouseDown(e, 'ne')} />
                            <div className="crop-box__handle crop-box__handle--e" onMouseDown={(e) => handleMouseDown(e, 'e')} />
                            <div className="crop-box__handle crop-box__handle--se" onMouseDown={(e) => handleMouseDown(e, 'se')} />
                            <div className="crop-box__handle crop-box__handle--s" onMouseDown={(e) => handleMouseDown(e, 's')} />
                            <div className="crop-box__handle crop-box__handle--sw" onMouseDown={(e) => handleMouseDown(e, 'sw')} />
                            <div className="crop-box__handle crop-box__handle--w" onMouseDown={(e) => handleMouseDown(e, 'w')} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
