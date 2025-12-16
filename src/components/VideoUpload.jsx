import { useState, useRef, useCallback } from 'react';
import { ScreenRecorder } from './ScreenRecorder';

export function VideoUpload({ onVideoLoad, isRecording, onRecordingStart, onRecordingEnd }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef(null);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        if (!isRecording) {
            setIsDragOver(true);
        }
    }, [isRecording]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);

        if (isRecording) return;

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            validateAndLoadVideo(files[0]);
        }
    }, [isRecording]);

    const handleClick = () => {
        if (!isRecording) {
            inputRef.current?.click();
        }
    };

    const handleFileChange = (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            validateAndLoadVideo(files[0]);
        }
    };

    const validateAndLoadVideo = (file) => {
        const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

        if (!validTypes.includes(file.type)) {
            alert('Formato não suportado. Use MP4, WebM ou MOV.');
            return;
        }

        // Regular file upload, no known duration
        onVideoLoad(file, null);
    };

    const handleRecordingComplete = (file, duration) => {
        // Screen recording with known duration
        onVideoLoad(file, duration);
    };

    // When recording, show minimal UI
    if (isRecording) {
        return (
            <div className="video-upload-container video-upload-container--recording">
                <div className="recording-placeholder">
                    <p>Gravando sua tela...</p>
                    <p className="recording-placeholder__hint">A gravação aparecerá aqui quando você parar</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`video-upload-container ${isDragOver ? 'video-upload-container--dragover' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            <div className="video-upload-options">
                {/* Upload option */}
                <button
                    className="video-upload-option"
                    onClick={handleClick}
                >
                    <div className="video-upload-option__icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </div>
                    <span className="video-upload-option__title">Enviar vídeo</span>
                    <span className="video-upload-option__subtitle">MP4, WebM ou MOV</span>
                </button>

                {/* Screen recorder option */}
                <ScreenRecorder
                    onRecordingComplete={handleRecordingComplete}
                    isRecording={isRecording}
                    onRecordingStart={onRecordingStart}
                    onRecordingEnd={onRecordingEnd}
                />
            </div>

            <p className="video-upload-hint">
                ou arraste um arquivo de vídeo aqui
            </p>
        </div>
    );
}
