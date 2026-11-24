/**
 * Interactive Piano Roll Timeline Renderer
 * Visualizes pitch vs time grid with colored note bars and synchronized playhead.
 */

class PianoRollRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.notes = [];
        this.currentTime = 0;
        this.minMidi = 48; // C3
        this.maxMidi = 84; // C6
        this.pixelsPerSecond = 85;
        this.keyHeight = 14;
        this.scrollX = 0;
        this.keyboardWidth = 50;

        this.colors = [
            '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185',
            '#f97316', '#facc15', '#4ade80', '#2dd4bf', '#06b6d4'
        ];
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.ctx.resetTransform?.();
            this.ctx.scale(dpr, dpr);
            this.width = rect.width;
            this.height = rect.height;
            this.render();
        }
    }

    setNotes(notes) {
        this.notes = notes;
        if (notes.length > 0) {
            // Auto-adjust vertical pitch bounds to encompass notes
            const midis = notes.map(n => n.midi);
            this.minMidi = Math.max(21, Math.min(...midis) - 3);
            this.maxMidi = Math.min(108, Math.max(...midis) + 3);
            this.keyHeight = Math.max(10, Math.min(20, this.height / (this.maxMidi - this.minMidi + 1)));
        }
        this.render();
    }

    setCurrentTime(time) {
        this.currentTime = time;
        const playheadX = this.keyboardWidth + this.currentTime * this.pixelsPerSecond;
        if (playheadX - this.scrollX > this.width * 0.75) {
            this.scrollX = playheadX - this.width * 0.4;
        } else if (playheadX - this.scrollX < this.keyboardWidth) {
            this.scrollX = Math.max(0, playheadX - this.keyboardWidth);
        }
        this.render();
    }

    render() {
        if (!this.width || !this.height) this.resize();
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);

        const totalKeys = this.maxMidi - this.minMidi + 1;
        const totalDuration = this.notes.length > 0
            ? Math.max(10, this.notes[this.notes.length - 1].startTime + 5)
            : 30;
        const totalWidth = Math.max(w, this.keyboardWidth + totalDuration * this.pixelsPerSecond + 150);

        ctx.save();
        ctx.translate(-this.scrollX, 0);

        // 1. Draw Background Lanes
        for (let m = this.maxMidi; m >= this.minMidi; m--) {
            const y = (this.maxMidi - m) * this.keyHeight;
            const isBlack = (m % 12 === 1 || m % 12 === 3 || m % 12 === 6 || m % 12 === 8 || m % 12 === 10);
            const isC = (m % 12 === 0);

            if (isC) {
                ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
            } else if (isBlack) {
                ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            } else {
                ctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
            }
            ctx.fillRect(this.keyboardWidth, y, totalWidth, this.keyHeight);

            // Lane dividing line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.keyboardWidth, y + this.keyHeight);
            ctx.lineTo(totalWidth, y + this.keyHeight);
            ctx.stroke();
        }

        // 2. Draw Beat & Measure Grid Lines
        const secondsPerBeat = 0.6; // ~100 BPM
        const totalBeats = Math.ceil(totalDuration / secondsPerBeat);

        for (let b = 0; b <= totalBeats; b++) {
            const x = this.keyboardWidth + b * secondsPerBeat * this.pixelsPerSecond;
            const isMeasure = (b % 4 === 0);

            ctx.strokeStyle = isMeasure ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = isMeasure ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();

            if (isMeasure && b > 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.font = '10px monospace';
                ctx.fillText(`${b / 4 + 1}`, x + 4, 12);
            }
        }

        // 3. Draw Note Bars
        for (const note of this.notes) {
            const x = this.keyboardWidth + note.startTime * this.pixelsPerSecond;
            const width = Math.max(8, note.duration * this.pixelsPerSecond);
            const y = (this.maxMidi - note.midi) * this.keyHeight + 1;
            const height = this.keyHeight - 2;

            const isPlaying = Math.abs(this.currentTime - note.startTime) < (note.duration || 0.3);
            const color = isPlaying ? '#fbbf24' : this.colors[note.midi % this.colors.length];

            ctx.save();
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = isPlaying ? 10 : 4;

            // Rounded rectangle note block
            this.fillRoundedRect(ctx, x, y, width, height, 3);

            // Note label on bar
            if (width > 24) {
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 9px system-ui';
                ctx.fillText(note.noteName || PitchDetector.midiToNoteName(note.midi), x + 4, y + height - 3);
            }
            ctx.restore();
        }

        // 4. Draw Playhead Line
        const playheadX = this.keyboardWidth + this.currentTime * this.pixelsPerSecond;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();

        ctx.restore();

        // 5. Sticky Piano Keyboard Ruler on Left
        this.drawKeyboardRuler(ctx, h);
    }

    drawKeyboardRuler(ctx, h) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
        ctx.fillRect(0, 0, this.keyboardWidth, h);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(this.keyboardWidth, 0);
        ctx.lineTo(this.keyboardWidth, h);
        ctx.stroke();

        for (let m = this.maxMidi; m >= this.minMidi; m--) {
            const y = (this.maxMidi - m) * this.keyHeight;
            const isBlack = (m % 12 === 1 || m % 12 === 3 || m % 12 === 6 || m % 12 === 8 || m % 12 === 10);
            const isC = (m % 12 === 0);

            ctx.fillStyle = isBlack ? '#1e293b' : '#e2e8f0';
            ctx.fillRect(0, y, this.keyboardWidth - 2, this.keyHeight - 1);

            if (isC || this.keyHeight >= 14) {
                ctx.fillStyle = isBlack ? '#94a3b8' : '#0f172a';
                ctx.font = 'bold 9px monospace';
                ctx.textAlign = 'right';
                ctx.fillText(PitchDetector.midiToNoteName(m), this.keyboardWidth - 5, y + this.keyHeight - 3);
            }
        }
    }

    fillRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }
}

window.PianoRollRenderer = PianoRollRenderer;
