import { useState, useRef, useCallback } from 'react';

export function VideoUpload({ onVideoLoad }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef(null);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            validateAndLoadVideo(files[0]);
        }
    }, []);

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            validateAndLoadVideo(files[0]);
        }
    };

    const validateAndLoadVideo = (file) => {
        const validTypes = ['video/mp4', 'video/webm'];

        if (!validTypes.includes(file.type)) {
            alert('Formato não suportado. Use MP4 ou WebM.');
            return;
        }

        onVideoLoad(file);
    };

    return (
        <div
            className={`video-upload ${isDragOver ? 'video-upload--dragover' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
        >
            <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/webm"
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />

            <svg className="video-upload__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
            </svg>

            <h2 className="video-upload__title">Arraste um vídeo aqui</h2>
            <p className="video-upload__subtitle">ou clique para selecionar um arquivo</p>

            <div className="video-upload__formats">
                <span className="video-upload__format">MP4</span>
                <span className="video-upload__format">WebM</span>
            </div>
        </div>
    );
}
