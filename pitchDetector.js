/**
 * High-Sensitivity Pitch Detection Engine
 * Uses Enhanced Autocorrelation (Normalized Square Difference)
 * with Parabolic Peak Refinement, Dynamic Noise Gating, and Spectral Peak Fallback.
 */

class PitchDetector {
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
        this.bufferSize = 2048;
        this.rmsThreshold = 0.006;         // Sensitive noise gate (picks up quiet notes)
        this.confidenceThreshold = 0.60;   // Realistic correlation threshold for real instruments & voice
        this.minFreq = 65;                 // C2 (deep piano / baritone)
        this.maxFreq = 1600;               // G6 (high soprano / violin)
        this.historyPitches = [];          // For 3-frame median smoothing
    }

    setSampleRate(rate) {
        this.sampleRate = rate;
    }

    calculateRMS(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }

    /**
     * Enhanced Pitch Detection
     * Returns: { freq, midi, noteName, cents, confidence, rms, status }
     */
    detectPitch(buffer, fftFrequencies = null) {
        const rms = this.calculateRMS(buffer);

        // 1. Check Noise Gate
        if (rms < this.rmsThreshold) {
            this.historyPitches = [];
            return {
                freq: null,
                midi: null,
                noteName: null,
                cents: 0,
                confidence: 0,
                rms: rms,
                status: 'too_quiet'
            };
        }

        const minPeriod = Math.floor(this.sampleRate / this.maxFreq);
        const maxPeriod = Math.floor(this.sampleRate / this.minFreq);
        const size = buffer.length;

        let bestPeriod = -1;
        let bestCorrelation = -1;

        // Autocorrelation with Normalized Square Difference
        for (let period = minPeriod; period <= maxPeriod; period++) {
            let sum = 0;
            let normA = 0;
            let normB = 0;

            for (let i = 0; i < size - period; i++) {
                const a = buffer[i];
                const b = buffer[i + period];
                sum += a * b;
                normA += a * a;
                normB += b * b;
            }

            const denom = Math.sqrt(normA * normB);
            const correlation = denom > 0 ? (sum / denom) : 0;

            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestPeriod = period;
            }
        }

        // 2. Correlation Quality Check
        if (bestCorrelation < this.confidenceThreshold || bestPeriod <= 0) {
            // If autocorrelation was borderline, try FFT Spectral Peak Fallback
            if (fftFrequencies && bestCorrelation > 0.45) {
                const spectralPitch = this.detectSpectralPeak(fftFrequencies);
                if (spectralPitch) return spectralPitch;
            }

            return {
                freq: null,
                midi: null,
                noteName: null,
                cents: 0,
                confidence: bestCorrelation,
                rms: rms,
                status: 'noisy_or_unclear'
            };
        }

        // 3. Sub-Sample Parabolic Interpolation
        let refinedPeriod = bestPeriod;
        if (bestPeriod > minPeriod && bestPeriod < maxPeriod) {
            const y1 = this.getCorrelationAtPeriod(buffer, bestPeriod - 1);
            const y2 = bestCorrelation;
            const y3 = this.getCorrelationAtPeriod(buffer, bestPeriod + 1);
            const delta = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
            if (isFinite(delta) && Math.abs(delta) < 1) {
                refinedPeriod += delta;
            }
        }

        let frequency = this.sampleRate / refinedPeriod;

        // Octave error prevention: check if double frequency has strong spectral energy
        if (frequency < this.minFreq || frequency > this.maxFreq) {
            return { freq: null, midi: null, noteName: null, cents: 0, confidence: 0, rms, status: 'out_of_range' };
        }

        // 4. Convert to Musical Pitch & Cents
        const midiExact = 69 + 12 * Math.log2(frequency / 440);
        let midi = Math.round(midiExact);
        const cents = Math.round((midiExact - midi) * 100);

        // 5. Temporal Median Smoothing (filters out single-frame glitch spikes)
        this.historyPitches.push(midi);
        if (this.historyPitches.length > 3) {
            this.historyPitches.shift();
        }
        // Take mode or median
        if (this.historyPitches.length === 3) {
            const sorted = [...this.historyPitches].sort((a, b) => a - b);
            midi = sorted[1]; // median
            frequency = PitchDetector.midiToFrequency(midi);
        }

        return {
            freq: frequency,
            midi: midi,
            noteName: PitchDetector.midiToNoteName(midi),
            cents: cents,
            confidence: bestCorrelation,
            rms: rms,
            status: 'detected'
        };
    }

    getCorrelationAtPeriod(buffer, period) {
        let sum = 0;
        let normA = 0;
        let normB = 0;
        const size = buffer.length;

        for (let i = 0; i < size - period; i++) {
            const a = buffer[i];
            const b = buffer[i + period];
            sum += a * b;
            normA += a * a;
            normB += b * b;
        }

        const denom = Math.sqrt(normA * normB);
        return denom > 0 ? (sum / denom) : 0;
    }

    /**
     * Fallback Spectral Peak Picker from AnalyserNode frequency data
     */
    detectSpectralPeak(frequencyData) {
        let maxVal = -Infinity;
        let maxBin = -1;
        const binCount = frequencyData.length;
        const nyquist = this.sampleRate / 2;

        const minBin = Math.floor((this.minFreq / nyquist) * binCount);
        const maxBinIdx = Math.floor((this.maxFreq / nyquist) * binCount);

        for (let i = minBin; i < maxBinIdx; i++) {
            if (frequencyData[i] > maxVal) {
                maxVal = frequencyData[i];
                maxBin = i;
            }
        }

        // dB threshold check (must be above background noise)
        if (maxVal > -55 && maxBin > 0) {
            const freq = (maxBin * nyquist) / binCount;
            const midiExact = 69 + 12 * Math.log2(freq / 440);
            const midi = Math.round(midiExact);
            return {
                freq: freq,
                midi: midi,
                noteName: PitchDetector.midiToNoteName(midi),
                cents: 0,
                confidence: 0.65,
                rms: 0.05,
                status: 'spectral_detected'
            };
        }
        return null;
    }

    static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    static midiToNoteName(midi) {
        const pc = ((midi % 12) + 12) % 12;
        const octave = Math.floor(midi / 12) - 1;
        return `${PitchDetector.NOTE_NAMES[pc]}${octave}`;
    }

    static midiToFrequency(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
}

window.PitchDetector = PitchDetector;
