/**
 * Advanced Audio Pitch Detection & Onset Extraction Engine
 * Uses Enhanced Autocorrelation (Normalized Square Difference / YIN)
 * with Parabolic Interpolation and RMS Noise Gate.
 */

class PitchDetector {
    constructor(sampleRate = 44100) {
        this.sampleRate = sampleRate;
        this.bufferSize = 2048;
        this.rmsThreshold = 0.015; // Noise gate minimum energy
        this.confidenceThreshold = 0.82; // Autocorrelation correlation quality
        this.minFreq = 55;   // ~A1 (bass)
        this.maxFreq = 1500; // ~F#6 (high soprano/flute)
    }

    setSampleRate(rate) {
        this.sampleRate = rate;
    }

    /**
     * Calculate Root Mean Square (RMS) energy to detect volume / onsets
     */
    calculateRMS(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }

    /**
     * Detect fundamental pitch (Hz) using Normalized Autocorrelation
     * Returns { freq, midi, noteName, cents, confidence, rms }
     */
    detectPitch(buffer) {
        const rms = this.calculateRMS(buffer);
        if (rms < this.rmsThreshold) {
            return { freq: null, midi: null, noteName: null, cents: 0, confidence: 0, rms };
        }

        const minPeriod = Math.floor(this.sampleRate / this.maxFreq);
        const maxPeriod = Math.floor(this.sampleRate / this.minFreq);

        const size = buffer.length;
        let bestPeriod = -1;
        let bestCorrelation = 0;

        // Autocorrelation loop with normalized square difference
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

        if (bestCorrelation < this.confidenceThreshold || bestPeriod <= 0) {
            return { freq: null, midi: null, noteName: null, cents: 0, confidence: bestCorrelation, rms };
        }

        // Parabolic Interpolation for sub-sample peak refinement
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

        const frequency = this.sampleRate / refinedPeriod;

        // Safety clamp
        if (frequency < this.minFreq || frequency > this.maxFreq) {
            return { freq: null, midi: null, noteName: null, cents: 0, confidence: 0, rms };
        }

        // Convert to MIDI and Note Name
        const midiExact = 69 + 12 * Math.log2(frequency / 440);
        const midi = Math.round(midiExact);
        const cents = Math.round((midiExact - midi) * 100);

        return {
            freq: frequency,
            midi: midi,
            noteName: PitchDetector.midiToNoteName(midi),
            cents: cents,
            confidence: bestCorrelation,
            rms: rms
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

    static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    static midiToNoteName(midi) {
        const pc = midi % 12;
        const octave = Math.floor(midi / 12) - 1;
        return `${PitchDetector.NOTE_NAMES[pc]}${octave}`;
    }

    static midiToFrequency(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
}

window.PitchDetector = PitchDetector;
