/**
 * Music Transcription Engine with Dropout Hysteresis & Note Smoothing
 * Segments continuous pitch detection streams into discrete musical notes
 * without false fragmentation from breath, vibrato, or room echo.
 */

class MusicTranscriber {
    constructor() {
        this.bpm = 100;
        this.timeSignature = { numerator: 4, denominator: 4 };
        this.minNoteDuration = 0.07; // 70ms minimum note length
        this.currentNote = null;
        this.transcribedNotes = [];
        this.lastPitchMidi = null;
        this.lastRms = 0;
        this.currentTime = 0;

        // Dropout tolerance (bridges micro-gaps and breaths without fragmenting notes)
        this.dropoutFrames = 0;
        this.maxDropoutFrames = 4; // ~80-120ms grace period

        this.onNoteAdded = null;
        this.onNoteUpdated = null;
    }

    setBpm(bpm) {
        this.bpm = Math.max(40, Math.min(240, bpm));
    }

    reset() {
        this.currentNote = null;
        this.transcribedNotes = [];
        this.lastPitchMidi = null;
        this.lastRms = 0;
        this.currentTime = 0;
        this.dropoutFrames = 0;
    }

    /**
     * Process a real-time pitch sample
     * @param {Object} pitchResult - { midi, freq, rms, confidence, status }
     * @param {number} timestamp - current audio timestamp in seconds
     */
    processSample(pitchResult, timestamp) {
        this.currentTime = timestamp;
        const midi = pitchResult.midi;
        const rms = pitchResult.rms;

        // Energy onset check (sharp rise in volume signals new note attack even if same pitch)
        const isEnergyOnset = rms > 0.035 && rms > this.lastRms * 2.0;
        this.lastRms = rms;

        if (midi !== null) {
            // Valid pitch detected!
            this.dropoutFrames = 0;

            if (this.currentNote === null) {
                // Start a brand new note
                this.startNote(midi, timestamp, rms);
            } else if (this.currentNote.midi !== midi || isEnergyOnset) {
                // Pitch shifted or new attack: finalize previous note and start new one
                this.finalizeCurrentNote(timestamp);
                this.startNote(midi, timestamp, rms);
            } else {
                // Sustain current note
                this.currentNote.duration = timestamp - this.currentNote.startTime;
                if (this.onNoteUpdated) {
                    this.onNoteUpdated(this.currentNote);
                }
            }
        } else {
            // No pitch detected in this frame (silence, breath, unvoiced consonant, or noise)
            if (this.currentNote !== null) {
                this.dropoutFrames++;
                // Only terminate note after grace period expires
                if (this.dropoutFrames > this.maxDropoutFrames) {
                    this.finalizeCurrentNote(timestamp - (this.dropoutFrames * 0.025));
                    this.dropoutFrames = 0;
                } else {
                    // Extend note during momentary drop
                    this.currentNote.duration = timestamp - this.currentNote.startTime;
                }
            }
        }
    }

    startNote(midi, startTime, rms) {
        this.currentNote = {
            id: 'note_' + Math.random().toString(36).substr(2, 9),
            midi: midi,
            noteName: PitchDetector.midiToNoteName(midi),
            startTime: startTime,
            duration: 0.05,
            velocity: Math.min(1.0, Math.max(0.4, rms * 5.0)),
            quantized: null
        };
    }

    finalizeCurrentNote(endTime) {
        if (!this.currentNote) return;

        this.currentNote.duration = Math.max(0.05, endTime - this.currentNote.startTime);

        // Ignore micro-glitches shorter than min duration
        if (this.currentNote.duration >= this.minNoteDuration) {
            this.quantizeNote(this.currentNote);
            this.transcribedNotes.push(this.currentNote);
            if (this.onNoteAdded) {
                this.onNoteAdded(this.currentNote);
            }
        }

        this.currentNote = null;
    }

    /**
     * Quantize duration into musical rhythmic value (Quarter, Half, Eighth, etc.)
     */
    quantizeNote(note) {
        const secondsPerBeat = 60.0 / this.bpm;
        const beats = note.duration / secondsPerBeat;

        let type = 'quarter';
        let beatLength = 1.0;

        if (beats >= 2.8) {
            type = 'whole';
            beatLength = 4.0;
        } else if (beats >= 1.4) {
            type = 'half';
            beatLength = 2.0;
        } else if (beats >= 0.65) {
            type = 'quarter';
            beatLength = 1.0;
        } else if (beats >= 0.3) {
            type = 'eighth';
            beatLength = 0.5;
        } else {
            type = 'sixteenth';
            beatLength = 0.25;
        }

        const startBeat = note.startTime / secondsPerBeat;
        const measure = Math.floor(startBeat / this.timeSignature.numerator) + 1;
        const beatInMeasure = (startBeat % this.timeSignature.numerator) + 1;

        note.quantized = {
            type: type,
            beats: beatLength,
            measure: measure,
            beatInMeasure: Number(beatInMeasure.toFixed(2))
        };
    }

    /**
     * Transcribe an entire AudioBuffer offline (uploaded MP3/WAV file)
     */
    async transcribeAudioBuffer(audioBuffer, pitchDetector, onProgress = null) {
        this.reset();
        const sampleRate = audioBuffer.sampleRate;
        pitchDetector.setSampleRate(sampleRate);

        const channelData = audioBuffer.getChannelData(0);
        const windowSize = 2048;
        const hopSize = 1024;
        const totalWindows = Math.floor((channelData.length - windowSize) / hopSize);

        const tempBuffer = new Float32Array(windowSize);

        for (let w = 0; w < totalWindows; w++) {
            const startIdx = w * hopSize;
            for (let i = 0; i < windowSize; i++) {
                tempBuffer[i] = channelData[startIdx + i];
            }

            const timestamp = startIdx / sampleRate;
            const pitchResult = pitchDetector.detectPitch(tempBuffer);

            this.processSample(pitchResult, timestamp);

            if (w % 80 === 0 && onProgress) {
                onProgress(w / totalWindows);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        if (this.currentNote !== null) {
            this.finalizeCurrentNote(channelData.length / sampleRate);
        }

        if (onProgress) onProgress(1.0);
        return this.transcribedNotes;
    }
}

window.MusicTranscriber = MusicTranscriber;
