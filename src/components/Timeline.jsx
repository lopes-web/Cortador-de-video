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
    const [isDragging, setIsDragging] = useState(null); // 'start', 'end', 'playhead'

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
        onSeek(time);
    };

    const handleMouseDown = (e, type) => {
        e.stopPropagation();
        setIsDragging(type);
    };

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;

        const time = getTimeFromPosition(e.clientX);

        if (isDragging === 'start') {
            const newStart = Math.max(0, Math.min(trimEnd - 0.1, time));
            onTrimChange(newStart, trimEnd);
        } else if (isDragging === 'end') {
            const newEnd = Math.max(trimStart + 0.1, Math.min(duration, time));
            onTrimChange(trimStart, newEnd);
        } else if (isDragging === 'playhead') {
            onSeek(Math.max(trimStart, Math.min(trimEnd, time)));
        }
    }, [isDragging, trimStart, trimEnd, duration, getTimeFromPosition, onTrimChange, onSeek]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(null);
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

    const startPercent = getPositionFromTime(trimStart);
    const endPercent = getPositionFromTime(trimEnd);
    const playheadPercent = getPositionFromTime(currentTime);

    return (
        <div className="timeline">
            <div className="timeline__time-display">
                <span>{formatTime(trimStart)}</span>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(trimEnd)}</span>
            </div>

            <div
                className="timeline__track-container"
                ref={trackRef}
                onClick={handleTrackClick}
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
                            <div key={index} className="timeline__thumbnail" style={{ background: '#1e3a5f' }} />
                        )
                    ))}
                </div>

                {/* Selected area */}
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
                        <div className="timeline__handle-line" />
                    </div>

                    {/* End handle */}
                    <div
                        className="timeline__handle timeline__handle--end"
                        onMouseDown={(e) => handleMouseDown(e, 'end')}
                    >
                        <div className="timeline__handle-line" />
                    </div>
                </div>

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
