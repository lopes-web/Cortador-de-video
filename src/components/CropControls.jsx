const ASPECT_RATIOS = [
    { label: 'Original', value: null },
    { label: '1:1', value: 1 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
];

export function CropControls({
    cropArea,
    videoWidth,
    videoHeight,
    onCropChange,
    selectedRatio,
    onRatioChange
}) {
    const handleRatioClick = (ratio) => {
        onRatioChange(ratio.value);

        if (ratio.value === null) {
            // Original - use full video
            onCropChange({
                x: 0,
                y: 0,
                width: videoWidth,
                height: videoHeight
            });
        } else {
            // Calculate centered crop with aspect ratio
            const targetRatio = ratio.value;
            const videoRatio = videoWidth / videoHeight;

            let newWidth, newHeight;

            if (targetRatio > videoRatio) {
                // Target is wider, fit to width
                newWidth = videoWidth;
                newHeight = videoWidth / targetRatio;
            } else {
                // Target is taller, fit to height
                newHeight = videoHeight;
                newWidth = videoHeight * targetRatio;
            }

            onCropChange({
                x: (videoWidth - newWidth) / 2,
                y: (videoHeight - newHeight) / 2,
                width: newWidth,
                height: newHeight
            });
        }
    };

    const handleDimensionChange = (dimension, value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 50) return;

        let newCrop = { ...cropArea };

        if (dimension === 'width') {
            newCrop.width = Math.min(numValue, videoWidth - cropArea.x);
        } else {
            newCrop.height = Math.min(numValue, videoHeight - cropArea.y);
        }

        onCropChange(newCrop);
        onRatioChange(null); // Custom dimensions, no preset
    };

    return (
        <>
            <div className="aspect-buttons">
                {ASPECT_RATIOS.map((ratio) => (
                    <button
                        key={ratio.label}
                        className={`aspect-btn ${selectedRatio === ratio.value ? 'aspect-btn--active' : ''}`}
                        onClick={() => handleRatioClick(ratio)}
                    >
                        {ratio.label}
                    </button>
                ))}
                <button
                    className={`aspect-btn ${selectedRatio === 'custom' ? 'aspect-btn--active' : ''}`}
                    onClick={() => onRatioChange('custom')}
                >
                    Personalizado
                </button>
            </div>

            <div className="dimension-inputs">
                <input
                    type="number"
                    className="dimension-input"
                    value={Math.round(cropArea.width)}
                    onChange={(e) => handleDimensionChange('width', e.target.value)}
                    min="50"
                    max={videoWidth}
                />
                <span className="dimension-label">px</span>
                <span className="dimension-label">×</span>
                <input
                    type="number"
                    className="dimension-input"
                    value={Math.round(cropArea.height)}
                    onChange={(e) => handleDimensionChange('height', e.target.value)}
                    min="50"
                    max={videoHeight}
                />
                <span className="dimension-label">px</span>
            </div>
        </>
    );
}
