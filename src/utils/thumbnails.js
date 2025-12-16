/**
 * Generate thumbnails from a video file at regular intervals
 * @param {File} videoFile - The video file
 * @param {number} count - Number of thumbnails to generate
 * @returns {Promise<string[]>} Array of data URLs for thumbnails
 */
export async function generateThumbnails(videoFile, count = 10) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const thumbnails = [];

        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(videoFile);
        video.src = url;

        let duration = 0;
        let isWebM = videoFile.type === 'video/webm';
        let hasTriedSeek = false;

        const cleanup = () => {
            URL.revokeObjectURL(url);
        };

        const generateThumbs = async () => {
            if (!isFinite(duration) || duration <= 0) {
                console.warn('Invalid video duration, skipping thumbnails');
                cleanup();
                resolve([]);
                return;
            }

            const interval = duration / count;

            // Set canvas size based on video dimensions
            const aspectRatio = video.videoWidth / video.videoHeight;
            canvas.height = 60;
            canvas.width = Math.round(60 * aspectRatio) || 100;

            for (let i = 0; i < count; i++) {
                const time = Math.min(i * interval, duration - 0.1);

                try {
                    const thumbnail = await captureFrame(video, canvas, ctx, time);
                    thumbnails.push(thumbnail);
                } catch (err) {
                    console.warn('Error capturing frame at', time);
                    thumbnails.push(null);
                }
            }

            cleanup();
            resolve(thumbnails);
        };

        // For WebM from screen recording, we need special handling
        const handleDurationFix = () => {
            if (isFinite(video.duration) && video.duration > 0) {
                duration = video.duration;
            }
        };

        video.onloadedmetadata = () => {
            handleDurationFix();

            // If duration is Infinity (common for WebM), try seeking to end
            if (!isFinite(duration) || duration <= 0) {
                if (isWebM && !hasTriedSeek) {
                    hasTriedSeek = true;
                    // Seek to a very large time to trigger duration calculation
                    video.currentTime = 1e10;
                    return;
                }
            }

            if (isFinite(duration) && duration > 0) {
                video.currentTime = 0;
                generateThumbs();
            }
        };

        video.onseeked = () => {
            handleDurationFix();

            if (hasTriedSeek && isFinite(duration) && duration > 0) {
                video.currentTime = 0;
                // Wait for seek to beginning before generating
                video.onseeked = () => {
                    generateThumbs();
                };
            }
        };

        video.ondurationchange = () => {
            handleDurationFix();
        };

        video.onerror = () => {
            console.warn('Error loading video for thumbnails');
            cleanup();
            resolve([]); // Return empty array instead of rejecting
        };

        // Timeout fallback - if nothing works after 5 seconds, give up on thumbnails
        setTimeout(() => {
            if (thumbnails.length === 0) {
                console.warn('Thumbnail generation timeout');
                cleanup();
                resolve([]);
            }
        }, 5000);
    });
}

/**
 * Capture a single frame from video at specified time
 */
function captureFrame(video, canvas, ctx, time) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            reject(new Error('Capture timeout'));
        }, 2000);

        const onSeeked = () => {
            clearTimeout(timeout);
            video.removeEventListener('seeked', onSeeked);

            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            } catch (err) {
                reject(err);
            }
        };

        video.addEventListener('seeked', onSeeked);
        video.currentTime = Math.max(0, time);
    });
}

/**
 * Format time in seconds to MM:SS.m format
 */
export function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '00:00.0';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}
