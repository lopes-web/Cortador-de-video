import { useState, useEffect } from 'react';

// Global state for screen recording
let globalStreamRef = null;
let globalMediaRecorderRef = null;
let globalChunksRef = [];
let globalStartTime = null;
let globalIsActive = false;
let globalMimeType = 'video/webm';
let globalOnRecordingEnd = null;
let globalOnRecordingComplete = null;

// Global stop function - exposed to window
function stopRecordingGlobal() {
    console.log('stopRecordingGlobal called, mediaRecorder state:', globalMediaRecorderRef?.state);
    if (globalMediaRecorderRef && globalMediaRecorderRef.state === 'recording') {
        globalMediaRecorderRef.stop();
    }
}

// Always expose to window
window.stopScreenRecording = stopRecordingGlobal;

export function ScreenRecorder({ onRecordingComplete, isRecording, onRecordingStart, onRecordingEnd }) {
    const [error, setError] = useState(null);

    // Store callbacks in globals so they can be accessed from onstop
    useEffect(() => {
        globalOnRecordingEnd = onRecordingEnd;
        globalOnRecordingComplete = onRecordingComplete;
    }, [onRecordingEnd, onRecordingComplete]);

    // Stop stream helper
    const stopStream = () => {
        if (globalStreamRef) {
            console.log('Stopping stream tracks...');
            globalStreamRef.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
            globalStreamRef = null;
        }
    };

    // Start recording
    const startRecording = async () => {
        setError(null);
        globalChunksRef = [];
        globalIsActive = false;

        try {
            console.log('Requesting screen capture...');

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always'
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            console.log('Stream obtained:', stream.getTracks().map(t => t.kind));

            globalStreamRef = stream;

            // Determine mimeType
            globalMimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                globalMimeType = 'video/webm;codecs=vp8,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                globalMimeType = 'video/webm;codecs=vp9';
            }
            console.log('Using mimeType:', globalMimeType);

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: globalMimeType,
                videoBitsPerSecond: 2500000
            });

            globalMediaRecorderRef = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                console.log('Data available:', e.data.size, 'bytes');
                if (e.data.size > 0) {
                    globalChunksRef.push(e.data);
                }
            };

            mediaRecorder.onstart = () => {
                console.log('MediaRecorder started');
                globalIsActive = true;
                globalStartTime = Date.now();
            };

            mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, chunks:', globalChunksRef.length);
                globalIsActive = false;

                if (globalChunksRef.length === 0) {
                    console.warn('Recording stopped but no data was captured');
                    stopStream();
                    if (globalOnRecordingEnd) globalOnRecordingEnd();
                    return;
                }

                const endTime = Date.now();
                const durationMs = endTime - (globalStartTime || endTime);
                const durationSeconds = Math.max(1, durationMs / 1000);
                console.log('Recording duration:', durationSeconds, 'seconds');

                const blob = new Blob(globalChunksRef, { type: globalMimeType });
                console.log('Blob size:', blob.size, 'bytes');

                if (blob.size < 1000) {
                    console.warn('Recording too short or empty');
                    stopStream();
                    if (globalOnRecordingEnd) globalOnRecordingEnd();
                    return;
                }

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const file = new File([blob], `gravacao_${timestamp}.webm`, {
                    type: 'video/webm'
                });

                console.log('File created:', file.name, file.size, 'bytes');

                stopStream();
                if (globalOnRecordingEnd) globalOnRecordingEnd();
                if (globalOnRecordingComplete) globalOnRecordingComplete(file, durationSeconds);
            };

            mediaRecorder.onerror = (e) => {
                console.error('MediaRecorder error:', e.error);
            };

            // Handle user stopping share from browser UI
            const videoTrack = stream.getVideoTracks()[0];
            videoTrack.onended = () => {
                console.log('Video track ended, isActive:', globalIsActive);
                if (globalIsActive && globalMediaRecorderRef && globalMediaRecorderRef.state === 'recording') {
                    console.log('Stopping MediaRecorder from track end');
                    globalMediaRecorderRef.stop();
                } else if (!globalIsActive) {
                    console.log('Track ended before recording started');
                    stopStream();
                    if (globalOnRecordingEnd) globalOnRecordingEnd();
                }
            };

            console.log('Starting MediaRecorder...');
            mediaRecorder.start(1000);

            setTimeout(() => {
                console.log('Notifying parent that recording started');
                onRecordingStart();
            }, 100);

        } catch (err) {
            console.error('Screen recording error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Permissão negada');
            } else {
                setError('Erro: ' + err.message);
            }
        }
    };

    if (isRecording) {
        return null;
    }

    return (
        <button
            className="screen-recorder__start-btn"
            onClick={startRecording}
        >
            <div className="screen-recorder__icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                    <circle cx="12" cy="10" r="3" fill="currentColor" stroke="none" />
                </svg>
            </div>
            <span className="screen-recorder__title">Gravar tela</span>
            <span className="screen-recorder__subtitle">Capture sua tela ou janela</span>
            {error && <span className="screen-recorder__error">{error}</span>}
        </button>
    );
}
