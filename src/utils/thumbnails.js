/**
 * Generate thumbnails from a video file at regular intervals
 * @param {File} videoFile - The video file
 * @param {number} count - Number of thumbnails to generate
 * @returns {Promise<string[]>} Array of data URLs for thumbnails
 */
export async function generateThumbnails(videoFile, count = 10) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const thumbnails = [];

        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;

        const url = URL.createObjectURL(videoFile);
        video.src = url;

        video.onloadedmetadata = async () => {
            const duration = video.duration;
            const interval = duration / count;

            // Set canvas size based on video dimensions
            const aspectRatio = video.videoWidth / video.videoHeight;
            canvas.height = 60;
            canvas.width = Math.round(60 * aspectRatio);

            for (let i = 0; i < count; i++) {
                const time = i * interval;

                try {
                    const thumbnail = await captureFrame(video, canvas, ctx, time);
                    thumbnails.push(thumbnail);
                } catch (err) {
                    console.error('Error capturing frame at', time, err);
                    thumbnails.push(null);
                }
            }

            URL.revokeObjectURL(url);
            resolve(thumbnails);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load video for thumbnail generation'));
        };
    });
}

/**
 * Capture a single frame from video at specified time
 */
function captureFrame(video, canvas, ctx, time) {
    return new Promise((resolve, reject) => {
        const onSeeked = () => {
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
        video.currentTime = time;
    });
}

/**
 * Format time in seconds to MM:SS.m format
 */
export function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00.0';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}
