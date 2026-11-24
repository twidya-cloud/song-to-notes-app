/**
 * Interactive Sheet Music Grand Staff Renderer (Canvas Engine)
 * Draws Treble & Bass staves, measures, note heads, stems, flags, ledger lines,
 * accidentals, and animated playhead.
 */

class SheetMusicScoreRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.notes = [];
        this.currentTime = 0;
        this.pixelsPerSecond = 85; // Horizontal note spacing
        this.lineSpacing = 11;     // Vertical spacing between staff lines
        this.scrollX = 0;
        this.onNoteClick = null;
        this.noteHitBoxes = []; // { x, y, width, height, note }

        this.setupInteractivity();
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
        this.render();
    }

    setCurrentTime(time) {
        this.currentTime = time;
        // Auto-scroll to keep playhead in view
        const playheadX = 90 + this.currentTime * this.pixelsPerSecond;
        if (playheadX - this.scrollX > this.width * 0.75) {
            this.scrollX = playheadX - this.width * 0.4;
        } else if (playheadX - this.scrollX < 90) {
            this.scrollX = Math.max(0, playheadX - 90);
        }
        this.render();
    }

    setupInteractivity() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left + this.scrollX;
            const clickY = e.clientY - rect.top;

            for (const hit of this.noteHitBoxes) {
                if (clickX >= hit.x && clickX <= hit.x + hit.width &&
                    clickY >= hit.y && clickY <= hit.y + hit.height) {
                    if (this.onNoteClick) {
                        this.onNoteClick(hit.note);
                    }
                    break;
                }
            }
        });
    }

    // Convert MIDI note number to diatonic staff step
    // C=0, D=1, E=2, F=3, G=4, A=5, B=6
    static midiToStaffStep(midi) {
        const diatonicSteps = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
        const octave = Math.floor(midi / 12) - 1;
        const pc = midi % 12;
        return octave * 7 + diatonicSteps[pc];
    }

    render() {
        if (!this.width || !this.height) this.resize();
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);
        this.noteHitBoxes = [];

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        const staffStartX = 80;
        const totalDuration = this.notes.length > 0 
            ? Math.max(10, this.notes[this.notes.length - 1].startTime + 5) 
            : 30;
        const totalWidth = Math.max(w, staffStartX + totalDuration * this.pixelsPerSecond + 150);

        ctx.save();
        ctx.translate(-this.scrollX, 0);

        const trebleCenterY = h * 0.32;
        const trebleBottomY = trebleCenterY + this.lineSpacing * 2;
        const bassCenterY = h * 0.70;
        const bassBottomY = bassCenterY + this.lineSpacing * 2;

        // 1. Draw Staves (5 lines each)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.2;

        // Treble staff lines
        for (let i = 0; i < 5; i++) {
            const y = trebleCenterY + (i - 2) * this.lineSpacing;
            ctx.beginPath();
            ctx.moveTo(staffStartX, y);
            ctx.lineTo(totalWidth, y);
            ctx.stroke();
        }

        // Bass staff lines
        for (let i = 0; i < 5; i++) {
            const y = bassCenterY + (i - 2) * this.lineSpacing;
            ctx.beginPath();
            ctx.moveTo(staffStartX, y);
            ctx.lineTo(totalWidth, y);
            ctx.stroke();
        }

        // 2. Grand Staff Connector & Barlines
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(staffStartX, trebleCenterY - this.lineSpacing * 2);
        ctx.lineTo(staffStartX, bassCenterY + this.lineSpacing * 2);
        ctx.stroke();

        // Measure barlines (every 4 beats assuming 100 BPM = 2.4 seconds per measure)
        const secondsPerMeasure = 2.4;
        const totalMeasures = Math.ceil(totalDuration / secondsPerMeasure);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '10px monospace';

        for (let m = 1; m <= totalMeasures; m++) {
            const barX = staffStartX + (m * secondsPerMeasure * this.pixelsPerSecond);
            // Measure barline through staves
            ctx.beginPath();
            ctx.moveTo(barX, trebleCenterY - this.lineSpacing * 2);
            ctx.lineTo(barX, trebleCenterY + this.lineSpacing * 2);
            ctx.moveTo(barX, bassCenterY - this.lineSpacing * 2);
            ctx.lineTo(barX, bassCenterY + this.lineSpacing * 2);
            ctx.stroke();

            // Measure number
            ctx.fillText(`M${m}`, barX + 6, trebleCenterY - this.lineSpacing * 2.5);
        }

        // 3. Draw Transcribed Notes
        for (let i = 0; i < this.notes.length; i++) {
            const note = this.notes[i];
            const noteX = staffStartX + note.startTime * this.pixelsPerSecond;
            this.drawNoteOnStaff(ctx, note, noteX, trebleBottomY, bassBottomY);
        }

        // 4. Draw Animated Playhead Cursor
        const playheadX = staffStartX + this.currentTime * this.pixelsPerSecond;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(playheadX, 10);
        ctx.lineTo(playheadX, h - 10);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.restore();

        // 5. Draw Fixed Clefs & Title Overlay on the left
        this.drawClefs(ctx, trebleCenterY, bassCenterY);
    }

    drawClefs(ctx, trebleCenterY, bassCenterY) {
        // Semi-transparent backdrop for sticky clef bar
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.fillRect(0, 0, 78, this.height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(78, 0);
        ctx.lineTo(78, this.height);
        ctx.stroke();

        ctx.font = 'bold 28px serif';
        ctx.fillStyle = '#a5b4fc';
        ctx.textAlign = 'center';
        ctx.fillText('𝄞', 40, trebleCenterY + 10); // Treble Clef
        ctx.fillText('𝄢', 40, bassCenterY + 8);   // Bass Clef

        // Time Signature 4/4
        ctx.font = 'bold 15px -apple-system, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('4', 65, trebleCenterY - 4);
        ctx.fillText('4', 65, trebleCenterY + 14);
        ctx.fillText('4', 65, bassCenterY - 4);
        ctx.fillText('4', 65, bassCenterY + 14);
    }

    drawNoteOnStaff(ctx, note, x, trebleBottomY, bassBottomY) {
        const midi = note.midi;
        const step = SheetMusicScoreRenderer.midiToStaffStep(midi);
        const isTreble = midi >= 60; // Middle C (60) or higher on treble

        const E4_STEP = 30; // E4 is bottom line of treble staff
        const G2_STEP = 18; // G2 is bottom line of bass staff

        let noteY;
        let staffBottomY;
        let bottomStep;

        if (isTreble) {
            bottomStep = E4_STEP;
            staffBottomY = trebleBottomY;
            noteY = staffBottomY - (step - bottomStep) * (this.lineSpacing / 2);
        } else {
            bottomStep = G2_STEP;
            staffBottomY = bassBottomY;
            noteY = staffBottomY - (step - bottomStep) * (this.lineSpacing / 2);
        }

        const isCurrentlyPlaying = Math.abs(this.currentTime - note.startTime) < (note.duration || 0.3);
        const noteColor = isCurrentlyPlaying ? '#fbbf24' : '#38bdf8';

        // Ledger lines
        ctx.strokeStyle = noteColor;
        ctx.lineWidth = 1.5;

        // Middle C (MIDI 60): 1 ledger line below treble staff
        if (midi === 60) {
            ctx.beginPath();
            ctx.moveTo(x - 12, noteY);
            ctx.lineTo(x + 12, noteY);
            ctx.stroke();
        } else if (isTreble && noteY > staffBottomY + 2) {
            // Notes lower than treble staff (e.g. D4, C4)
            for (let ly = staffBottomY + this.lineSpacing; ly <= noteY + 1; ly += this.lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 12, ly);
                ctx.lineTo(x + 12, ly);
                ctx.stroke();
            }
        } else if (isTreble && noteY < staffBottomY - 4 * this.lineSpacing - 2) {
            // Notes higher than treble staff (e.g. G5, A5, C6)
            const topY = staffBottomY - 4 * this.lineSpacing;
            for (let ly = topY - this.lineSpacing; ly >= noteY - 1; ly -= this.lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 12, ly);
                ctx.lineTo(x + 12, ly);
                ctx.stroke();
            }
        }

        // Accidental if sharp
        const isSharp = (midi % 12 === 1 || midi % 12 === 3 || midi % 12 === 6 || midi % 12 === 8 || midi % 12 === 10);
        if (isSharp) {
            ctx.font = 'bold 15px serif';
            ctx.fillStyle = noteColor;
            ctx.fillText('♯', x - 18, noteY + 5);
        }

        // Draw Note Head (Tilted Ellipse)
        const isHollow = note.quantized?.type === 'half' || note.quantized?.type === 'whole';
        ctx.save();
        ctx.translate(x, noteY);
        ctx.rotate(-0.25);
        ctx.fillStyle = noteColor;
        ctx.strokeStyle = noteColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 7.5, 5, 0, 0, Math.PI * 2);
        if (isHollow) {
            ctx.stroke();
        } else {
            ctx.fill();
        }
        ctx.restore();

        // Draw Stem (unless it's a whole note)
        if (note.quantized?.type !== 'whole') {
            const middleLineY = isTreble 
                ? trebleBottomY - 2 * this.lineSpacing 
                : bassBottomY - 2 * this.lineSpacing;

            ctx.beginPath();
            ctx.strokeStyle = noteColor;
            ctx.lineWidth = 1.8;

            if (noteY < middleLineY) {
                // Stem pointing down on left side
                ctx.moveTo(x - 6.5, noteY);
                ctx.lineTo(x - 6.5, noteY + 28);
            } else {
                // Stem pointing up on right side
                ctx.moveTo(x + 6.5, noteY);
                ctx.lineTo(x + 6.5, noteY - 28);
            }
            ctx.stroke();
        }

        // Note letter label above or below note
        ctx.font = 'bold 10px system-ui';
        ctx.fillStyle = noteColor;
        ctx.textAlign = 'center';
        ctx.fillText(note.noteName || PitchDetector.midiToNoteName(midi), x, noteY + 22);

        // Record hit box for clicking
        this.noteHitBoxes.push({
            x: x - 15,
            y: noteY - 20,
            width: 30,
            height: 45,
            note: note
        });
    }
}

window.SheetMusicScoreRenderer = SheetMusicScoreRenderer;
