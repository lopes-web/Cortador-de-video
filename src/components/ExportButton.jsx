import { useState } from 'react';
import { processVideo } from '../utils/ffmpeg';

export function ExportButton({ videoFile, cropArea, speed, trimStart, trimEnd, disabled }) {
    const [isExporting, setIsExporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const [format, setFormat] = useState('mp4');
    const [quality, setQuality] = useState('medium');

    const handleExport = async () => {
        if (!videoFile || isExporting) return;

        setShowOptions(false);
        setIsExporting(true);
        setProgress(0);
        setStatus('Inicializando FFmpeg...');

        try {
            const blob = await processVideo(videoFile, {
                cropX: cropArea.x,
                cropY: cropArea.y,
                cropWidth: cropArea.width,
                cropHeight: cropArea.height,
                speed,
                trimStart,
                trimEnd,
                format,
                quality,
            }, (p) => {
                setProgress(p);
                if (p < 30) {
                    setStatus('Processando...');
                } else if (p < 70) {
                    setStatus('Aplicando efeitos...');
                } else {
                    setStatus('Finalizando...');
                }
            });

            // Get original filename without extension
            const originalName = videoFile.name.replace(/\.[^/.]+$/, '');
            const timestamp = new Date().toISOString().slice(0, 10);
            const extension = format === 'gif' ? 'gif' : 'mp4';

            // Download the processed file
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${originalName}_edited_${timestamp}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setStatus('Concluído!');
            setTimeout(() => {
                setIsExporting(false);
                setProgress(0);
                setStatus('');
            }, 1000);

        } catch (error) {
            console.error('Export failed:', error);
            setStatus('');
            setIsExporting(false);
            setProgress(0);
            alert('Erro ao exportar: ' + error.message);
        }
    };

    return (
        <div className="export-container">
            <button
                className="export-btn"
                onClick={() => setShowOptions(!showOptions)}
                disabled={disabled || isExporting}
            >
                {isExporting ? (
                    <>
                        <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        Exportando...
                    </>
                ) : (
                    <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Exportar
                    </>
                )}
            </button>

            {showOptions && !isExporting && (
                <div className="export-options">
                    <div className="export-options__section">
                        <label className="export-options__label">Formato</label>
                        <div className="export-options__buttons">
                            <button
                                className={`export-option-btn ${format === 'mp4' ? 'export-option-btn--active' : ''}`}
                                onClick={() => setFormat('mp4')}
                            >
                                MP4
                            </button>
                            <button
                                className={`export-option-btn ${format === 'gif' ? 'export-option-btn--active' : ''}`}
                                onClick={() => setFormat('gif')}
                            >
                                GIF
                            </button>
                        </div>
                    </div>

                    <div className="export-options__section">
                        <label className="export-options__label">Qualidade</label>
                        <div className="export-options__buttons">
                            <button
                                className={`export-option-btn ${quality === 'low' ? 'export-option-btn--active' : ''}`}
                                onClick={() => setQuality('low')}
                            >
                                Baixa
                            </button>
                            <button
                                className={`export-option-btn ${quality === 'medium' ? 'export-option-btn--active' : ''}`}
                                onClick={() => setQuality('medium')}
                            >
                                Média
                            </button>
                            <button
                                className={`export-option-btn ${quality === 'high' ? 'export-option-btn--active' : ''}`}
                                onClick={() => setQuality('high')}
                            >
                                Alta
                            </button>
                        </div>
                    </div>

                    <button className="export-confirm-btn" onClick={handleExport}>
                        Exportar {format.toUpperCase()}
                    </button>
                </div>
            )}

            {isExporting && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal__icon">
                            <div className="loading-spinner" />
                        </div>
                        <h3 className="modal__title">
                            Exportando {format.toUpperCase()}
                        </h3>
                        <div className="progress-bar">
                            <div
                                className="progress-bar__fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="progress-text">
                            {progress}% • {status}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
