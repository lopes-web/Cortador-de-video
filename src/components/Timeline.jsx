import { useState, useRef, useEffect, useCallback } from 'react';
import { formatTime } from '../utils/thumbnails';

export function Timeline({
    duration,
    currentTime,
    trimStart,
    trimEnd,
    thumbnails,
    onTrimChange,
    onSeek
}) {
    const trackRef = useRef(null);
    const [isDragging, setIsDragging] = useState(null);
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverX, setHoverX] = useState(0);

    const getPositionFromTime = (time) => {
        if (!duration) return 0;
        return (time / duration) * 100;
    };

    const getTimeFromPosition = useCallback((clientX) => {
        if (!trackRef.current || !duration) return 0;

        const rect = trackRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        return percentage * duration;
    }, [duration]);

    const handleTrackClick = (e) => {
        if (isDragging) return;
        const time = getTimeFromPosition(e.clientX);
        // Clicking sets playhead position
        onSeek(Math.max(0, Math.min(duration, time)));
    };

    const handleMouseDown = (e, type) => {
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(type);
    };

    const handleMouseMove = useCallback((e) => {
        // Update hover time for preview
        if (trackRef.current) {
            const rect = trackRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x >= 0 && x <= rect.width) {
                setHoverTime(getTimeFromPosition(e.clientX));
                setHoverX(x);
            } else {
                setHoverTime(null);
            }
        }

        if (!isDragging) return;

        const time = getTimeFromPosition(e.clientX);

        if (isDragging === 'start') {
            // Minimum 0.5 second selection
            const newStart = Math.max(0, Math.min(trimEnd - 0.5, time));
            onTrimChange(newStart, trimEnd);
        } else if (isDragging === 'end') {
            const newEnd = Math.max(trimStart + 0.5, Math.min(duration, time));
            onTrimChange(trimStart, newEnd);
        } else if (isDragging === 'playhead') {
            onSeek(Math.max(0, Math.min(duration, time)));
        }
    }, [isDragging, trimStart, trimEnd, duration, getTimeFromPosition, onTrimChange, onSeek]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(null);
    }, []);

    const handleMouseLeave = () => {
        if (!isDragging) {
            setHoverTime(null);
        }
    };

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

    const startPercent = getPositionFromTime(trimStart);
    const endPercent = getPositionFromTime(trimEnd);
    const playheadPercent = getPositionFromTime(currentTime);
    const trimDuration = trimEnd - trimStart;

    return (
        <div className="timeline">
            <div className="timeline__time-display">
                <span>{formatTime(trimStart)}</span>
                <span className="timeline__current-time">{formatTime(currentTime)}</span>
                <span>{formatTime(trimEnd)}</span>
            </div>

            <div
                className="timeline__track-container"
                ref={trackRef}
                onClick={handleTrackClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {/* Thumbnails */}
                <div className="timeline__thumbnails">
                    {thumbnails.map((thumb, index) => (
                        thumb ? (
                            <img
                                key={index}
                                src={thumb}
                                alt=""
                                className="timeline__thumbnail"
                                draggable={false}
                            />
                        ) : (
                            <div key={index} className="timeline__thumbnail" style={{ background: '#232428' }} />
                        )
                    ))}
                </div>

                {/* Dim areas outside selection */}
                <div
                    className="timeline__dim-area"
                    style={{ left: 0, width: `${startPercent}%` }}
                />
                <div
                    className="timeline__dim-area"
                    style={{ left: `${endPercent}%`, right: 0 }}
                />

                {/* Selected area with handles */}
                <div
                    className="timeline__selected-area"
                    style={{
                        left: `${startPercent}%`,
                        width: `${endPercent - startPercent}%`
                    }}
                >
                    {/* Start handle */}
                    <div
                        className="timeline__handle timeline__handle--start"
                        onMouseDown={(e) => handleMouseDown(e, 'start')}
                    >
                        <div className="timeline__handle-grip">
                            <span></span>
                            <span></span>
                        </div>
                    </div>

                    {/* Duration indicator */}
                    <div className="timeline__duration-indicator">
                        {formatTime(trimDuration)}
                    </div>

                    {/* End handle */}
                    <div
                        className="timeline__handle timeline__handle--end"
                        onMouseDown={(e) => handleMouseDown(e, 'end')}
                    >
                        <div className="timeline__handle-grip">
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>

                {/* Hover time indicator */}
                {hoverTime !== null && !isDragging && (
                    <div
                        className="timeline__hover-indicator"
                        style={{ left: hoverX }}
                    >
                        <span className="timeline__hover-time">{formatTime(hoverTime)}</span>
                    </div>
                )}

                {/* Playhead */}
                <div
                    className="timeline__playhead"
                    style={{ left: `${playheadPercent}%` }}
                    onMouseDown={(e) => handleMouseDown(e, 'playhead')}
                />
            </div>
        </div>
    );
}
