/**
 * Music Transcription Engine
 * Segments continuous pitch detection streams into discrete musical notes
 * with musical timing, duration, quantized rhythmic values, and measures.
 */

class MusicTranscriber {
    constructor() {
        this.bpm = 100;
        this.timeSignature = { numerator: 4, denominator: 4 };
        this.minNoteDuration = 0.08; // 80ms minimum note length to reject transient noise
        this.currentNote = null;
        this.transcribedNotes = [];
        this.lastPitchMidi = null;
        this.lastRms = 0;
        this.currentTime = 0;

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
    }

    /**
     * Process a real-time pitch sample
     * @param {Object} pitchResult - { midi, freq, rms, confidence }
     * @param {number} timestamp - current audio timestamp in seconds
     */
    processSample(pitchResult, timestamp) {
        this.currentTime = timestamp;
        const midi = pitchResult.midi;
        const rms = pitchResult.rms;

        // Energy onset check (sharp rise in volume signals new note attack even if same pitch)
        const isEnergyOnset = rms > 0.04 && rms > this.lastRms * 2.2;
        this.lastRms = rms;

        if (midi !== null) {
            // Valid pitch detected
            if (this.currentNote === null) {
                // Start new note
                this.startNote(midi, timestamp, rms);
            } else if (this.currentNote.midi !== midi || isEnergyOnset) {
                // Pitch changed or new attack: finalize previous note and start new one
                this.finalizeCurrentNote(timestamp);
                this.startNote(midi, timestamp, rms);
            } else {
                // Sustain existing note
                this.currentNote.duration = timestamp - this.currentNote.startTime;
                if (this.onNoteUpdated) {
                    this.onNoteUpdated(this.currentNote);
                }
            }
        } else {
            // Silence / no confident pitch
            if (this.currentNote !== null) {
                this.finalizeCurrentNote(timestamp);
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
            velocity: Math.min(1.0, rms * 4.0),
            quantized: null
        };
    }

    finalizeCurrentNote(endTime) {
        if (!this.currentNote) return;

        this.currentNote.duration = endTime - this.currentNote.startTime;

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

        // Standard rhythmic values in beats (in 4/4)
        // 4.0 = Whole, 2.0 = Half, 1.0 = Quarter, 0.5 = Eighth, 0.25 = Sixteenth
        let type = 'quarter';
        let beatLength = 1.0;

        if (beats >= 3.0) {
            type = 'whole';
            beatLength = 4.0;
        } else if (beats >= 1.5) {
            type = 'half';
            beatLength = 2.0;
        } else if (beats >= 0.75) {
            type = 'quarter';
            beatLength = 1.0;
        } else if (beats >= 0.35) {
            type = 'eighth';
            beatLength = 0.5;
        } else {
            type = 'sixteenth';
            beatLength = 0.25;
        }

        // Measure calculation (4 beats per measure)
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
     * Transcribe an entire AudioBuffer offline (e.g. uploaded MP3/WAV file)
     * Rapid multi-pass analysis for instant sheet music generation
     */
    async transcribeAudioBuffer(audioBuffer, pitchDetector, onProgress = null) {
        this.reset();
        const sampleRate = audioBuffer.sampleRate;
        pitchDetector.setSampleRate(sampleRate);

        // Analyze audio in sliding windows of 2048 samples with 50% overlap
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

        // Finalize remaining note if any
        if (this.currentNote !== null) {
            this.finalizeCurrentNote(channelData.length / sampleRate);
        }

        if (onProgress) onProgress(1.0);
        return this.transcribedNotes;
    }
}

window.MusicTranscriber = MusicTranscriber;
