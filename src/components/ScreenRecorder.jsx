import { useState, useRef, useEffect, useCallback } from 'react';

// Keep refs outside component to avoid cleanup issues
let globalStreamRef = null;
let globalMediaRecorderRef = null;
let globalChunksRef = [];
let globalStartTime = null;
let globalIsActive = false;

export function ScreenRecorder({ onRecordingComplete, isRecording, onRecordingStart, onRecordingEnd }) {
    const [error, setError] = useState(null);

    // Stop stream helper
    const stopStream = useCallback(() => {
        if (globalStreamRef) {
            console.log('Stopping stream tracks...');
            globalStreamRef.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
            globalStreamRef = null;
        }
    }, []);

    // Stop recording helper
    const stopRecording = useCallback(() => {
        console.log('Stop recording called, state:', globalMediaRecorderRef?.state, 'active:', globalIsActive);
        if (globalMediaRecorderRef && globalMediaRecorderRef.state === 'recording') {
            globalMediaRecorderRef.stop();
        }
    }, []);

    // Start recording
    const startRecording = async () => {
        setError(null);
        globalChunksRef = [];
        globalIsActive = false;

        try {
            console.log('Requesting screen capture...');

            // Request screen capture with audio
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

            // Create MediaRecorder
            let mimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                mimeType = 'video/webm;codecs=vp8,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
            }
            console.log('Using mimeType:', mimeType);

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType,
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
                console.log('MediaRecorder stopped, chunks:', globalChunksRef.length, 'active:', globalIsActive);
                globalIsActive = false;

                if (globalChunksRef.length === 0) {
                    console.warn('Recording stopped but no data was captured');
                    stopStream();
                    onRecordingEnd();
                    return;
                }

                const endTime = Date.now();
                const durationMs = endTime - (globalStartTime || endTime);
                const durationSeconds = Math.max(1, durationMs / 1000);
                console.log('Recording duration:', durationSeconds, 'seconds');

                const blob = new Blob(globalChunksRef, { type: mimeType });
                console.log('Blob size:', blob.size, 'bytes');

                if (blob.size < 1000) {
                    console.warn('Recording too short or empty');
                    stopStream();
                    onRecordingEnd();
                    return;
                }

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const file = new File([blob], `gravacao_${timestamp}.webm`, {
                    type: 'video/webm'
                });

                console.log('File created:', file.name, file.size, 'bytes');

                stopStream();
                onRecordingEnd();
                onRecordingComplete(file, durationSeconds);
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
                    onRecordingEnd();
                }
            };

            // Start recording FIRST, then notify parent
            console.log('Starting MediaRecorder...');
            mediaRecorder.start(1000);

            // Small delay before notifying parent to ensure recorder is started
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

    // Expose stop function when recording
    useEffect(() => {
        if (isRecording) {
            window.stopScreenRecording = stopRecording;
        }
        return () => {
            delete window.stopScreenRecording;
        };
    }, [isRecording, stopRecording]);

    // Don't render anything when recording (indicator is in header)
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
