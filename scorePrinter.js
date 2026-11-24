/**
 * Professional Multi-System Sheet Music Print & PDF Engine
 * Formats transcribed music into clean, multi-system pages (4 measures per line)
 * with proportional spacing, ledger lines, measure numbers, and print styling.
 */

class ScorePrinter {
    constructor() {
        this.measuresPerSystem = 4;
        this.systemWidth = 800; // standard printable page content width in points
        this.lineSpacing = 9;   // staff line gap
        this.showLabels = true;
    }

    /**
     * Format and generate full multi-system printable sheet music into target container
     */
    generatePrintableScore(container, notes, bpm = 100, options = {}) {
        container.innerHTML = '';
        this.measuresPerSystem = options.measuresPerSystem || 4;
        this.showLabels = options.showLabels !== undefined ? options.showLabels : true;

        if (!notes || notes.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#64748b; font-size:14px;">No notes transcribed yet to print!</div>';
            return;
        }

        const secondsPerBeat = 60.0 / bpm;
        const secondsPerMeasure = secondsPerBeat * 4; // 4/4 time

        // Calculate total measures
        const lastNote = notes[notes.length - 1];
        const lastTime = lastNote.startTime + (lastNote.duration || 0.5);
        const totalMeasures = Math.max(1, Math.ceil(lastTime / secondsPerMeasure));
        const totalSystems = Math.ceil(totalMeasures / this.measuresPerSystem);

        // 1. Create Sheet Music Header
        const headerEl = document.createElement('div');
        headerEl.className = 'print-score-header';
        headerEl.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 0; color: #0f172a; font-family: serif;">Transcribed Musical Score</h1>
                <div style="font-size: 13px; color: #475569; margin-top: 6px; font-style: italic;">
                    Tempo: ♩ = ${bpm} BPM &nbsp;•&nbsp; Time Signature: 4/4 &nbsp;•&nbsp; ${notes.length} Notes Total
                </div>
            </div>
        `;
        container.appendChild(headerEl);

        // Group notes by system
        for (let s = 0; s < totalSystems; s++) {
            const startMeasure = s * this.measuresPerSystem + 1;
            const endMeasure = Math.min(totalMeasures, (s + 1) * this.measuresPerSystem);

            const systemStartTime = (startMeasure - 1) * secondsPerMeasure;
            const systemEndTime = endMeasure * secondsPerMeasure;

            // Notes falling in this system
            const systemNotes = notes.filter(n => n.startTime >= systemStartTime && n.startTime < systemEndTime);

            const systemEl = this.renderSystem(s, startMeasure, endMeasure, systemNotes, systemStartTime, secondsPerMeasure);
            container.appendChild(systemEl);
        }
    }

    renderSystem(systemIndex, startMeasure, endMeasure, notes, systemStartTime, secondsPerMeasure) {
        const wrapper = document.createElement('div');
        wrapper.className = 'print-system-wrapper';

        const canvas = document.createElement('canvas');
        canvas.className = 'print-system-canvas';

        const dpr = 2; // high resolution for razor sharp printing
        const w = this.systemWidth;
        const h = 210;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // Draw system staves and barlines
        this.drawSystemContent(ctx, w, h, systemIndex, startMeasure, endMeasure, notes, systemStartTime, secondsPerMeasure);

        wrapper.appendChild(canvas);
        return wrapper;
    }

    drawSystemContent(ctx, w, h, systemIndex, startMeasure, endMeasure, notes, systemStartTime, secondsPerMeasure) {
        const leftMargin = 60;
        const rightMargin = 20;
        const printableWidth = w - leftMargin - rightMargin;

        const trebleCenterY = 48;
        const trebleBottomY = trebleCenterY + this.lineSpacing * 2;
        const bassCenterY = 135;
        const bassBottomY = bassCenterY + this.lineSpacing * 2;

        const numMeasuresInSystem = endMeasure - startMeasure + 1;
        const measureWidth = printableWidth / this.measuresPerSystem;

        // 1. Draw Staves (Treble and Bass)
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.0;

        // Treble staff lines
        for (let i = 0; i < 5; i++) {
            const y = trebleCenterY + (i - 2) * this.lineSpacing;
            ctx.beginPath();
            ctx.moveTo(leftMargin, y);
            ctx.lineTo(w - rightMargin, y);
            ctx.stroke();
        }

        // Bass staff lines
        for (let i = 0; i < 5; i++) {
            const y = bassCenterY + (i - 2) * this.lineSpacing;
            ctx.beginPath();
            ctx.moveTo(leftMargin, y);
            ctx.lineTo(w - rightMargin, y);
            ctx.stroke();
        }

        // 2. Grand Staff Left Bracket
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(leftMargin, trebleCenterY - this.lineSpacing * 2);
        ctx.lineTo(leftMargin, bassCenterY + this.lineSpacing * 2);
        ctx.stroke();

        // 3. Draw Clefs on every system
        ctx.font = 'bold 26px serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.fillText('𝄞', leftMargin - 32, trebleCenterY + 9);
        ctx.fillText('𝄢', leftMargin - 32, bassCenterY + 7);

        // First system has 4/4 Time Signature
        if (systemIndex === 0) {
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('4', leftMargin - 12, trebleCenterY - 3);
            ctx.fillText('4', leftMargin - 12, trebleCenterY + 12);
            ctx.fillText('4', leftMargin - 12, bassCenterY - 3);
            ctx.fillText('4', leftMargin - 12, bassCenterY + 12);
        }

        // 4. Draw Measure Barlines & Numbers
        ctx.lineWidth = 1.0;
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#475569';

        for (let m = 0; m < numMeasuresInSystem; m++) {
            const measureNum = startMeasure + m;
            const barX = leftMargin + (m + 1) * measureWidth;

            // Barline through staves
            ctx.beginPath();
            ctx.moveTo(barX, trebleCenterY - this.lineSpacing * 2);
            ctx.lineTo(barX, trebleCenterY + this.lineSpacing * 2);
            ctx.moveTo(barX, bassCenterY - this.lineSpacing * 2);
            ctx.lineTo(barX, bassCenterY + this.lineSpacing * 2);
            ctx.stroke();

            // Measure number at top left of measure
            const measureStartX = leftMargin + m * measureWidth;
            ctx.fillText(`M${measureNum}`, measureStartX + 4, trebleCenterY - this.lineSpacing * 2.6);
        }

        // Final double barline on the very last measure
        if (endMeasure === startMeasure + numMeasuresInSystem - 1 && numMeasuresInSystem < this.measuresPerSystem) {
            const finalBarX = leftMargin + numMeasuresInSystem * measureWidth;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(finalBarX, trebleCenterY - this.lineSpacing * 2);
            ctx.lineTo(finalBarX, bassCenterY + this.lineSpacing * 2);
            ctx.stroke();
        }

        // 5. Draw Notes with Proportional Spacing within Measures
        for (const note of notes) {
            const noteRelTime = note.startTime - systemStartTime;
            const measureIdx = Math.floor(noteRelTime / secondsPerMeasure);
            if (measureIdx < 0 || measureIdx >= this.measuresPerSystem) continue;

            const timeInMeasure = noteRelTime % secondsPerMeasure;
            const measureStartX = leftMargin + measureIdx * measureWidth;
            // Pad inside measure: notes start at +15px to avoid clashing with barline
            const noteX = measureStartX + 18 + (timeInMeasure / secondsPerMeasure) * (measureWidth - 36);

            this.drawPrintableNote(ctx, note, noteX, trebleBottomY, bassBottomY);
        }
    }

    drawPrintableNote(ctx, note, x, trebleBottomY, bassBottomY) {
        const midi = note.midi;
        const step = SheetMusicScoreRenderer.midiToStaffStep(midi);
        const isTreble = midi >= 60; // C4 and above on Treble

        const E4_STEP = 30; // E4 is bottom line of treble
        const G2_STEP = 18; // G2 is bottom line of bass

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

        ctx.strokeStyle = '#000000';
        ctx.fillStyle = '#000000';
        ctx.lineWidth = 1.4;

        // Ledger lines
        if (midi === 60) {
            // Middle C
            ctx.beginPath();
            ctx.moveTo(x - 11, noteY);
            ctx.lineTo(x + 11, noteY);
            ctx.stroke();
        } else if (isTreble && noteY > staffBottomY + 2) {
            for (let ly = staffBottomY + this.lineSpacing; ly <= noteY + 1; ly += this.lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 11, ly);
                ctx.lineTo(x + 11, ly);
                ctx.stroke();
            }
        } else if (isTreble && noteY < staffBottomY - 4 * this.lineSpacing - 2) {
            const topY = staffBottomY - 4 * this.lineSpacing;
            for (let ly = topY - this.lineSpacing; ly >= noteY - 1; ly -= this.lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 11, ly);
                ctx.lineTo(x + 11, ly);
                ctx.stroke();
            }
        } else if (!isTreble && noteY > staffBottomY + 2) {
            for (let ly = staffBottomY + this.lineSpacing; ly <= noteY + 1; ly += this.lineSpacing) {
                ctx.beginPath();
                ctx.moveTo(x - 11, ly);
                ctx.lineTo(x + 11, ly);
                ctx.stroke();
            }
        }

        // Accidental if sharp
        const isSharp = (midi % 12 === 1 || midi % 12 === 3 || midi % 12 === 6 || midi % 12 === 8 || midi % 12 === 10);
        if (isSharp) {
            ctx.font = 'bold 14px serif';
            ctx.fillText('♯', x - 16, noteY + 5);
        }

        // Note Head (Tilted Ellipse)
        const isHollow = note.quantized?.type === 'half' || note.quantized?.type === 'whole';
        ctx.save();
        ctx.translate(x, noteY);
        ctx.rotate(-0.25);
        ctx.beginPath();
        ctx.ellipse(0, 0, 6.5, 4.5, 0, 0, Math.PI * 2);
        if (isHollow) {
            ctx.stroke();
        } else {
            ctx.fill();
        }
        ctx.restore();

        // Stems
        if (note.quantized?.type !== 'whole') {
            const middleLineY = isTreble 
                ? trebleBottomY - 2 * this.lineSpacing 
                : bassBottomY - 2 * this.lineSpacing;

            ctx.lineWidth = 1.4;
            ctx.beginPath();
            if (noteY < middleLineY) {
                // Stem down on left
                ctx.moveTo(x - 5.5, noteY);
                ctx.lineTo(x - 5.5, noteY + 26);
            } else {
                // Stem up on right
                ctx.moveTo(x + 5.5, noteY);
                ctx.lineTo(x + 5.5, noteY - 26);
            }
            ctx.stroke();

            // Eighth note flag
            if (note.quantized?.type === 'eighth' || note.quantized?.type === 'sixteenth') {
                ctx.beginPath();
                if (noteY < middleLineY) {
                    ctx.moveTo(x - 5.5, noteY + 26);
                    ctx.quadraticCurveTo(x + 3, noteY + 20, x + 6, noteY + 14);
                } else {
                    ctx.moveTo(x + 5.5, noteY - 26);
                    ctx.quadraticCurveTo(x + 12, noteY - 20, x + 15, noteY - 14);
                }
                ctx.stroke();
            }
        }

        // Note Label below note head
        if (this.showLabels) {
            ctx.font = 'bold 8.5px sans-serif';
            ctx.fillStyle = '#334155';
            ctx.textAlign = 'center';
            ctx.fillText(note.noteName || PitchDetector.midiToNoteName(midi), x, noteY + 18);
        }
    }
}

window.scorePrinter = new ScorePrinter();
