export function SpeedControls({ speed, onSpeedChange }) {
    const handleSliderChange = (e) => {
        onSpeedChange(parseFloat(e.target.value));
    };

    return (
        <div className="speed-controls">
            <span className="speed-label">Velocidade</span>
            <div className="speed-slider-container">
                <input
                    type="range"
                    className="speed-slider"
                    min="0.25"
                    max="4"
                    step="0.25"
                    value={speed}
                    onChange={handleSliderChange}
                />
                <span className="speed-value">{speed}x</span>
            </div>
        </div>
    );
}
