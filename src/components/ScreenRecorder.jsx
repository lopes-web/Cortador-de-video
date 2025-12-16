import { useState, useRef, useEffect } from 'react';

export function ScreenRecorder({ onRecordingComplete, isRecording, onRecordingStart, onRecordingEnd }) {
    const [error, setError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const startTimeRef = useRef(null);
    const isRecordingActiveRef = useRef(false);

    // Start recording
    const startRecording = async () => {
        setError(null);
        chunksRef.current = [];
        isRecordingActiveRef.current = false;

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

            streamRef.current = stream;

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
                videoBitsPerSecond: 2500000 // 2.5 Mbps
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                console.log('Data available:', e.data.size, 'bytes');
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstart = () => {
                console.log('MediaRecorder started');
                isRecordingActiveRef.current = true;
                startTimeRef.current = Date.now();
            };

            mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, chunks:', chunksRef.current.length, 'active:', isRecordingActiveRef.current);
                isRecordingActiveRef.current = false;

                // Only process if we have actual recorded data
                if (chunksRef.current.length === 0) {
                    console.warn('Recording stopped but no data was captured');
                    stopStream();
                    onRecordingEnd();
                    return;
                }

                // Calculate duration from start time
                const endTime = Date.now();
                const durationMs = endTime - (startTimeRef.current || endTime);
                const durationSeconds = Math.max(1, durationMs / 1000);
                console.log('Recording duration:', durationSeconds, 'seconds');

                // Create blob
                const blob = new Blob(chunksRef.current, { type: mimeType });
                console.log('Blob size:', blob.size, 'bytes');

                // Only proceed if blob has actual content
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

                // Clean up
                stopStream();
                onRecordingEnd();

                // Send to editor with known duration
                onRecordingComplete(file, durationSeconds);
            };

            mediaRecorder.onerror = (e) => {
                console.error('MediaRecorder error:', e.error);
            };

            // Handle user stopping share from browser UI
            // Only stop if recording has actually started
            const videoTrack = stream.getVideoTracks()[0];
            videoTrack.onended = () => {
                console.log('Video track ended, isActive:', isRecordingActiveRef.current);
                if (isRecordingActiveRef.current && mediaRecorderRef.current) {
                    if (mediaRecorderRef.current.state === 'recording') {
                        console.log('Stopping MediaRecorder from track end');
                        mediaRecorderRef.current.stop();
                    }
                } else {
                    // Track ended before recording started - just clean up
                    console.log('Track ended before recording started');
                    stopStream();
                    onRecordingEnd();
                }
            };

            // Start recording
            console.log('Starting MediaRecorder...');
            mediaRecorder.start(1000); // Get data every second

            // Notify parent that recording has started
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
        console.log('Stop recording called, state:', mediaRecorderRef.current?.state, 'active:', isRecordingActiveRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    // Stop stream
    const stopStream = () => {
        if (streamRef.current) {
            console.log('Stopping stream tracks...');
            streamRef.current.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
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
