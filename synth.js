/**
 * Audio Synthesizer for Playback of Transcribed Notes
 */

class AudioPlaybackSynth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.playbackTimer = null;
        this.activeVoices = new Map();
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
    }

    playTone(midi, duration = 0.5, velocity = 0.8) {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        const now = this.ctx.currentTime;

        // Tri-harmonic warm tone
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, now);

        const v = Math.pow(velocity, 1.2) * 0.4;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(v, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration + 0.05);
        osc2.stop(now + duration + 0.05);
    }

    playScore(notes, onProgress = null, onComplete = null) {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.stopScore();

        if (!notes || notes.length === 0) return;

        this.isPlaying = true;
        const startTime = this.ctx.currentTime;
        const totalDuration = notes[notes.length - 1].startTime + notes[notes.length - 1].duration;

        notes.forEach(n => {
            const noteStart = startTime + n.startTime;
            const dur = Math.max(0.1, n.duration);
            setTimeout(() => {
                if (this.isPlaying) {
                    this.playTone(n.midi, dur, n.velocity || 0.8);
                }
            }, n.startTime * 1000);
        });

        // Animation progress loop
        const startTimestamp = performance.now();
        const updateLoop = () => {
            if (!this.isPlaying) return;
            const elapsed = (performance.now() - startTimestamp) / 1000;
            if (onProgress) onProgress(elapsed);

            if (elapsed < totalDuration + 0.5) {
                this.playbackTimer = requestAnimationFrame(updateLoop);
            } else {
                this.isPlaying = false;
                if (onComplete) onComplete();
            }
        };
        this.playbackTimer = requestAnimationFrame(updateLoop);
    }

    stopScore() {
        this.isPlaying = false;
        if (this.playbackTimer) {
            cancelAnimationFrame(this.playbackTimer);
            this.playbackTimer = null;
        }
    }
}

window.playbackSynth = new AudioPlaybackSynth();
