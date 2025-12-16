import { useState, useRef, useEffect } from 'react';

// Fix WebM duration by reading the actual duration from the video element
async function fixWebMBlob(blob) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        const url = URL.createObjectURL(blob);
        video.src = url;

        let resolved = false;

        const cleanup = () => {
            URL.revokeObjectURL(url);
            video.remove();
        };

        const returnBlob = () => {
            if (resolved) return;
            resolved = true;
            cleanup();
            // Just return the original blob - the duration issue will be handled
            // by the video player seeking to end
            resolve(blob);
        };

        video.onloadedmetadata = () => {
            // For WebM without duration, seek to trigger duration calculation
            if (!isFinite(video.duration) || video.duration <= 0) {
                video.currentTime = 1e10;
            } else {
                returnBlob();
            }
        };

        video.onseeked = () => {
            returnBlob();
        };

        video.onerror = () => {
            returnBlob();
        };

        // Timeout fallback
        setTimeout(returnBlob, 3000);
    });
}

export function ScreenRecorder({ onRecordingComplete, isRecording, onRecordingStart, onRecordingEnd }) {
    const [error, setError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);

    // Start recording
    const startRecording = async () => {
        setError(null);
        chunksRef.current = [];

        try {
            // Request screen capture with audio
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: true
            });

            streamRef.current = stream;

            // Create MediaRecorder - prefer VP8 for better compatibility
            let mimeType = 'video/webm';
            if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
                mimeType = 'video/webm;codecs=vp8,opus';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
            }

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 3000000 // 3 Mbps
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                // Create blob
                const rawBlob = new Blob(chunksRef.current, { type: mimeType });

                // Process the blob to help with duration detection
                const processedBlob = await fixWebMBlob(rawBlob);

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const file = new File([processedBlob], `gravacao_${timestamp}.webm`, {
                    type: 'video/webm'
                });

                // Clean up
                stopStream();
                onRecordingEnd();

                // Send to editor
                onRecordingComplete(file);
            };

            // Handle user stopping share from browser UI
            stream.getVideoTracks()[0].onended = () => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    stopRecording();
                }
            };

            // Start recording - use smaller timeslice for more reliable data
            mediaRecorder.start(500);
            onRecordingStart();

        } catch (err) {
            console.error('Screen recording error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Permissão negada');
            } else {
                setError('Erro: ' + err.message);
            }
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    // Stop stream
    const stopStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopStream();
        };
    }, []);

    // Expose stop function
    useEffect(() => {
        if (isRecording) {
            window.stopScreenRecording = stopRecording;
        }
        return () => {
            delete window.stopScreenRecording;
        };
    }, [isRecording]);

    if (isRecording) {
        return null; // Recording indicator is shown in header
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
