import { useState, useRef, useEffect } from 'react';

export function ScreenRecorder({ onRecordingComplete }) {
    const [state, setState] = useState('idle'); // idle | recording
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    // Format duration as MM:SS
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

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

            // Create MediaRecorder
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : 'video/webm';

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

            mediaRecorder.onstop = () => {
                // Create blob and file
                const blob = new Blob(chunksRef.current, { type: 'video/webm' });
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const file = new File([blob], `gravacao_${timestamp}.webm`, { type: 'video/webm' });

                // Clean up
                stopStream();
                clearInterval(timerRef.current);
                setDuration(0);
                setState('idle');

                // Send to editor
                onRecordingComplete(file);
            };

            // Handle user stopping share from browser UI
            stream.getVideoTracks()[0].onended = () => {
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                    stopRecording();
                }
            };

            // Start recording
            mediaRecorder.start(1000); // Collect data every second
            setState('recording');
            setDuration(0);

            // Start timer
            timerRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);

        } catch (err) {
            console.error('Screen recording error:', err);
            if (err.name === 'NotAllowedError') {
                setError('Permissão negada. Por favor, permita o compartilhamento de tela.');
            } else {
                setError('Erro ao iniciar gravação: ' + err.message);
            }
            setState('idle');
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
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    if (state === 'recording') {
        return (
            <div className="screen-recorder screen-recorder--recording">
                <div className="screen-recorder__indicator">
                    <span className="screen-recorder__dot" />
                    Gravando...
                </div>
                <div className="screen-recorder__timer">
                    {formatDuration(duration)}
                </div>
                <button
                    className="screen-recorder__stop-btn"
                    onClick={stopRecording}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Parar Gravação
                </button>
            </div>
        );
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
