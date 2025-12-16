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

        video.onloadedmetadata = () => {
            if (isFinite(video.duration) && video.duration > 0) {
                duration = video.duration;
                video.currentTime = 0;
            }
        };

        video.oncanplay = () => {
            if (video.videoWidth > 0 && duration > 0 && thumbnails.length === 0) {
                generateThumbs();
            }
        };

        video.ondurationchange = () => {
            if (isFinite(video.duration) && video.duration > 0) {
                duration = video.duration;
            }
        };

        video.onerror = () => {
            console.warn('Error loading video for thumbnails');
            cleanup();
            resolve([]);
        };

        // Timeout fallback
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
 * Generate thumbnails from an existing video element (for screen recordings)
 * This avoids blob URL issues by using the already loaded video
 * @param {HTMLVideoElement} videoElement - The video element
 * @param {number} duration - Known duration of the video
 * @param {number} count - Number of thumbnails to generate
 * @returns {Promise<string[]>} Array of data URLs for thumbnails
 */
export async function generateThumbnailsFromVideo(videoElement, duration, count = 10) {
    return new Promise((resolve) => {
        if (!videoElement || !duration || duration <= 0) {
            resolve([]);
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const thumbnails = [];

        // Set canvas size based on video dimensions
        const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
        canvas.height = 60;
        canvas.width = Math.round(60 * aspectRatio) || 100;

        const interval = duration / count;
        let currentIndex = 0;
        const originalTime = videoElement.currentTime;

        const captureNext = () => {
            if (currentIndex >= count) {
                // Done, restore original time
                videoElement.currentTime = originalTime;
                resolve(thumbnails);
                return;
            }

            const time = Math.min(currentIndex * interval, duration - 0.1);

            const onSeeked = () => {
                videoElement.removeEventListener('seeked', onSeeked);

                try {
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    thumbnails.push(dataUrl);
                } catch (err) {
                    console.warn('Error capturing frame at', time);
                    thumbnails.push(null);
                }

                currentIndex++;
                captureNext();
            };

            videoElement.addEventListener('seeked', onSeeked);
            videoElement.currentTime = Math.max(0, time);
        };

        // Start capturing
        captureNext();

        // Timeout fallback
        setTimeout(() => {
            if (thumbnails.length < count) {
                console.warn('Thumbnail generation incomplete, got', thumbnails.length);
                videoElement.currentTime = originalTime;
                resolve(thumbnails);
            }
        }, 10000);
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
