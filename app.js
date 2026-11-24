/**
 * Main Application Controller for NoteScribe
 * Real-time Audio Listener, Pitch Transcriber, and Sheet Music Renderer
 */

class NoteScribeApp {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.mediaStream = null;
        this.sourceNode = null;
        this.audioBufferSource = null;
        this.currentAudioBuffer = null;

        // Engines
        this.pitchDetector = new PitchDetector();
        this.transcriber = new MusicTranscriber();
        this.synth = window.playbackSynth;

        // State
        this.isListeningMic = false;
        this.isPlayingAudio = false;
        this.activeSourceType = 'mic'; // 'mic', 'file', 'demo'
        this.audioStartTime = 0;
        this.pauseOffset = 0;
        this.transcribedNotes = [];
        this.rafId = null;

        // Canvases
        this.sheetCanvas = document.getElementById('sheet-music-canvas');
        this.rollCanvas = document.getElementById('piano-roll-canvas');
        this.waveformCanvas = document.getElementById('waveform-canvas');

        this.sheetRenderer = new SheetMusicScoreRenderer(this.sheetCanvas);
        this.rollRenderer = new PianoRollRenderer(this.rollCanvas);
        this.waveformCtx = this.waveformCanvas.getContext('2d');

        // HUD Elements
        this.currentNoteEl = document.getElementById('hud-note-name');
        this.currentFreqEl = document.getElementById('hud-freq-val');
        this.centsNeedleEl = document.getElementById('tuner-needle');
        this.centsValEl = document.getElementById('tuner-cents-val');
        this.statsNotesCountEl = document.getElementById('stats-notes-count');
        this.statsDurationEl = document.getElementById('stats-duration');
        this.vuBarEl = document.getElementById('vu-meter-bar');
        this.diagnosticEl = document.getElementById('hud-diagnostic-status');
        this.micGainNode = null;
        this.highpassFilter = null;
        this.currentGain = 2.0;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupTranscriberCallbacks();
        this.setupResizeHandlers();
        this.populateDemoSelector();
    }

    ensureAudioContext() {
        if (!this.audioCtx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioCtx();
            this.pitchDetector.setSampleRate(this.audioCtx.sampleRate);

            this.analyser = this.audioCtx.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.15;

            // Pre-amp gain booster for quiet microphones and distant instruments
            this.micGainNode = this.audioCtx.createGain();
            this.micGainNode.gain.setValueAtTime(this.currentGain, this.audioCtx.currentTime);

            // Highpass filter at 75Hz to eliminate AC hum and desk vibration rumble
            this.highpassFilter = this.audioCtx.createBiquadFilter();
            this.highpassFilter.type = 'highpass';
            this.highpassFilter.frequency.setValueAtTime(75, this.audioCtx.currentTime);
            this.highpassFilter.Q.setValueAtTime(0.7, this.audioCtx.currentTime);
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    setupResizeHandlers() {
        const resize = () => {
            this.sheetRenderer.resize();
            this.rollRenderer.resize();
            this.resizeWaveform();
        };
        window.addEventListener('resize', resize);
        setTimeout(resize, 100);
    }

    resizeWaveform() {
        const rect = this.waveformCanvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const dpr = window.devicePixelRatio || 1;
            this.waveformCanvas.width = rect.width * dpr;
            this.waveformCanvas.height = rect.height * dpr;
            this.waveformCtx.resetTransform?.();
            this.waveformCtx.scale(dpr, dpr);
            this.waveWidth = rect.width;
            this.waveHeight = rect.height;
        }
    }

    setupTranscriberCallbacks() {
        this.transcriber.onNoteAdded = (note) => {
            this.transcribedNotes = this.transcriber.transcribedNotes;
            this.sheetRenderer.setNotes(this.transcribedNotes);
            this.rollRenderer.setNotes(this.transcribedNotes);
            this.updateStats();
        };

        this.transcriber.onNoteUpdated = (note) => {
            this.sheetRenderer.setNotes(this.transcribedNotes);
            this.rollRenderer.setNotes(this.transcribedNotes);
        };

        this.sheetRenderer.onNoteClick = (note) => {
            this.synth.playTone(note.midi, note.duration || 0.4);
        };
    }

    setupEventListeners() {
        // Tab Input Switcher
        document.querySelectorAll('.source-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const src = btn.dataset.source;
                this.switchSourceTab(src);
            });
        });

        // 1. Microphone Toggle
        document.getElementById('mic-toggle-btn')?.addEventListener('click', () => {
            this.toggleMicrophone();
        });

        // Mic Gain Slider
        document.getElementById('mic-gain-slider')?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.currentGain = val;
            if (this.micGainNode && this.audioCtx) {
                this.micGainNode.gain.setValueAtTime(val, this.audioCtx.currentTime);
            }
            const display = document.getElementById('mic-gain-val');
            if (display) display.textContent = `${val.toFixed(1)}x`;
        });

        // Presets Selector
        document.getElementById('mic-preset-select')?.addEventListener('change', (e) => {
            this.applyPreset(e.target.value);
        });

        // 2. Audio File Upload
        const fileInput = document.getElementById('audio-file-input');
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.loadAudioFile(file);
        });

        // Drag and drop zone
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                if (e.dataTransfer.files.length > 0) {
                    this.loadAudioFile(e.dataTransfer.files[0]);
                }
            });
        }

        // 3. Demo Song Button
        document.getElementById('play-demo-btn')?.addEventListener('click', () => {
            const trackId = document.getElementById('demo-song-select').value;
            this.loadDemoSong(trackId);
        });

        // Playback Controls
        document.getElementById('play-btn')?.addEventListener('click', () => this.playTranscribedAudio());
        document.getElementById('pause-btn')?.addEventListener('click', () => this.pauseTranscribedAudio());
        document.getElementById('clear-btn')?.addEventListener('click', () => this.clearAll());

        // Settings Sliders
        document.getElementById('bpm-slider')?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            this.transcriber.setBpm(val);
            document.getElementById('bpm-val').textContent = `${val} BPM`;
        });

        document.getElementById('noise-threshold-slider')?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.pitchDetector.rmsThreshold = val;
            document.getElementById('noise-val').textContent = `${Math.round(val * 100)}%`;
        });

        // Export Buttons
        document.getElementById('export-midi-btn')?.addEventListener('click', () => this.exportMidi());
        document.getElementById('print-sheet-btn')?.addEventListener('click', () => this.openPrintModal());
        document.getElementById('export-json-btn')?.addEventListener('click', () => this.exportJson());

        // Print Modal Controls
        document.getElementById('close-print-modal-btn')?.addEventListener('click', () => this.closePrintModal());
        document.getElementById('do-print-btn')?.addEventListener('click', () => window.print());
        document.getElementById('print-labels-toggle')?.addEventListener('change', () => this.refreshPrintScore());
        document.getElementById('print-measures-per-line')?.addEventListener('change', () => this.refreshPrintScore());
    }

    populateDemoSelector() {
        const select = document.getElementById('demo-song-select');
        if (!select) return;
        select.innerHTML = '';
        DemoSongGenerator.DEMO_TRACKS.forEach(track => {
            const opt = document.createElement('option');
            opt.value = track.id;
            opt.textContent = track.title;
            select.appendChild(opt);
        });
    }

    switchSourceTab(source) {
        this.activeSourceType = source;
        document.querySelectorAll('.source-tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.source === source);
        });
        document.querySelectorAll('.source-panel').forEach(p => {
            p.classList.toggle('active', p.id === `panel-${source}`);
        });

        if (source !== 'mic' && this.isListeningMic) {
            this.toggleMicrophone(false);
        }
    }

    applyPreset(presetName) {
        let gain = 2.0;
        let rms = 0.006;
        let conf = 0.60;

        if (presetName === 'piano') {
            gain = 2.5; rms = 0.006; conf = 0.60;
        } else if (presetName === 'vocal') {
            gain = 2.0; rms = 0.005; conf = 0.58;
        } else if (presetName === 'guitar') {
            gain = 2.8; rms = 0.006; conf = 0.62;
        } else if (presetName === 'noisy') {
            gain = 1.0; rms = 0.020; conf = 0.72;
        } else if (presetName === 'quiet') {
            gain = 4.0; rms = 0.003; conf = 0.55;
        }

        this.currentGain = gain;
        this.pitchDetector.rmsThreshold = rms;
        this.pitchDetector.confidenceThreshold = conf;

        if (this.micGainNode && this.audioCtx) {
            this.micGainNode.gain.setValueAtTime(gain, this.audioCtx.currentTime);
        }

        const slider = document.getElementById('mic-gain-slider');
        const display = document.getElementById('mic-gain-val');
        if (slider) slider.value = gain;
        if (display) display.textContent = `${gain.toFixed(1)}x`;
    }

    // ==========================================
    // 1. REAL-TIME MICROPHONE LISTENING
    // ==========================================
    async toggleMicrophone(forceState = null) {
        this.ensureAudioContext();
        const shouldListen = forceState !== null ? forceState : !this.isListeningMic;

        const micBtn = document.getElementById('mic-toggle-btn');

        if (shouldListen) {
            try {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                });

                this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
                // Mic chain: source -> highpassFilter (cuts 75Hz rumble) -> micGainNode (boosts audio) -> analyser
                this.sourceNode.connect(this.highpassFilter);
                this.highpassFilter.connect(this.micGainNode);
                this.micGainNode.connect(this.analyser);

                this.isListeningMic = true;
                this.audioStartTime = this.audioCtx.currentTime;
                this.clearAll();

                micBtn.classList.add('listening');
                micBtn.innerHTML = '<span class="status-dot pulsing"></span> Listening... (Click to Stop)';
                this.startAnalysisLoop();
            } catch (err) {
                alert(`Microphone access error: ${err.message}. Please allow microphone permissions.`);
            }
        } else {
            this.isListeningMic = false;
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(t => t.stop());
                this.mediaStream = null;
            }
            if (this.sourceNode) {
                this.sourceNode.disconnect();
                this.sourceNode = null;
            }
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
            micBtn.classList.remove('listening');
            micBtn.innerHTML = '<span class="status-dot"></span> Start Listening (Microphone)';
            this.resetHUD();
        }
    }

    startAnalysisLoop() {
        const buffer = new Float32Array(this.analyser.fftSize);
        const freqBuffer = new Float32Array(this.analyser.frequencyBinCount);

        const loop = () => {
            if (!this.isListeningMic) return;
            this.analyser.getFloatTimeDomainData(buffer);
            this.analyser.getFloatFrequencyData(freqBuffer);

            const timestamp = this.audioCtx.currentTime - this.audioStartTime;
            const pitchResult = this.pitchDetector.detectPitch(buffer, freqBuffer);

            this.transcriber.processSample(pitchResult, timestamp);
            this.sheetRenderer.setCurrentTime(timestamp);
            this.rollRenderer.setCurrentTime(timestamp);

            this.updateHUD(pitchResult);
            this.drawWaveform(buffer);

            this.rafId = requestAnimationFrame(loop);
        };

        this.rafId = requestAnimationFrame(loop);
    }

    // ==========================================
    // 2. AUDIO FILE UPLOAD & TRANSCRIPTION
    // ==========================================
    async loadAudioFile(file) {
        this.ensureAudioContext();
        const statusEl = document.getElementById('file-status-msg');
        statusEl.textContent = `Analyzing "${file.name}"...`;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const decodedBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            this.currentAudioBuffer = decodedBuffer;

            statusEl.textContent = `Transcribing audio into notes...`;
            const notes = await this.transcriber.transcribeAudioBuffer(
                decodedBuffer,
                this.pitchDetector,
                (progress) => {
                    statusEl.textContent = `Transcribing: ${Math.round(progress * 100)}%`;
                }
            );

            this.transcribedNotes = notes;
            this.sheetRenderer.setNotes(notes);
            this.rollRenderer.setNotes(notes);
            this.updateStats();

            statusEl.textContent = `✓ Done! Transcribed ${notes.length} notes from "${file.name}". Click Play to listen!`;
        } catch (err) {
            statusEl.textContent = `❌ Error analyzing audio file: ${err.message}`;
        }
    }

    // ==========================================
    // 3. DEMO SONG LOADER
    // ==========================================
    async loadDemoSong(trackId) {
        this.ensureAudioContext();
        const statusEl = document.getElementById('demo-status-msg');
        statusEl.textContent = `Generating and listening to demo audio...`;

        const result = DemoSongGenerator.generateAudioBuffer(this.audioCtx, trackId);
        this.currentAudioBuffer = result.buffer;

        const notes = await this.transcriber.transcribeAudioBuffer(
            result.buffer,
            this.pitchDetector,
            (progress) => {
                statusEl.textContent = `Transcribing demo track: ${Math.round(progress * 100)}%`;
            }
        );

        this.transcribedNotes = notes;
        this.sheetRenderer.setNotes(notes);
        this.rollRenderer.setNotes(notes);
        this.updateStats();

        statusEl.textContent = `✓ Transcribed ${notes.length} notes for "${result.title}"! Playing audio...`;
        this.playTranscribedAudio();
    }

    // ==========================================
    // PLAYBACK CONTROLS
    // ==========================================
    playTranscribedAudio() {
        this.ensureAudioContext();
        if (this.transcribedNotes.length === 0) {
            alert('No notes transcribed yet! Speak into the mic or load a demo song first.');
            return;
        }

        // If we have an uploaded or demo audio buffer, play the original sound
        if (this.currentAudioBuffer) {
            if (this.audioBufferSource) {
                try { this.audioBufferSource.stop(); } catch (e) {}
            }
            this.audioBufferSource = this.audioCtx.createBufferSource();
            this.audioBufferSource.buffer = this.currentAudioBuffer;
            this.audioBufferSource.connect(this.audioCtx.destination);
            this.audioBufferSource.start(0, this.pauseOffset);
        }

        // Play the synthesized notes score in sync
        this.isPlayingAudio = true;
        const playBtn = document.getElementById('play-btn');
        playBtn.innerHTML = '<span>❚❚</span> Playing...';

        const startTime = performance.now();
        const duration = this.transcribedNotes[this.transcribedNotes.length - 1].startTime + 2.0;

        this.synth.playScore(
            this.transcribedNotes,
            (elapsed) => {
                this.sheetRenderer.setCurrentTime(elapsed);
                this.rollRenderer.setCurrentTime(elapsed);
            },
            () => {
                this.isPlayingAudio = false;
                playBtn.innerHTML = '<span>▶</span> Play';
            }
        );
    }

    pauseTranscribedAudio() {
        this.isPlayingAudio = false;
        this.synth.stopScore();
        if (this.audioBufferSource) {
            try { this.audioBufferSource.stop(); } catch (e) {}
            this.audioBufferSource = null;
        }
        document.getElementById('play-btn').innerHTML = '<span>▶</span> Play';
    }

    clearAll() {
        this.pauseTranscribedAudio();
        this.transcriber.reset();
        this.transcribedNotes = [];
        this.sheetRenderer.setNotes([]);
        this.rollRenderer.setNotes([]);
        this.sheetRenderer.setCurrentTime(0);
        this.rollRenderer.setCurrentTime(0);
        this.currentAudioBuffer = null;
        this.updateStats();
        this.resetHUD();
    }

    // ==========================================
    // HUD & TUNER UPDATES
    // ==========================================
    updateHUD(result) {
        // Update VU input volume meter bar
        if (this.vuBarEl && result) {
            const vuPercent = Math.min(100, Math.round(result.rms * 600));
            this.vuBarEl.style.width = `${vuPercent}%`;
        }

        if (result && result.midi !== null) {
            this.currentNoteEl.textContent = result.noteName;
            this.currentFreqEl.textContent = `${Math.round(result.freq)} Hz`;

            // Needle angle (-45deg to +45deg based on -50 to +50 cents)
            const angle = (result.cents / 50.0) * 45;
            this.centsNeedleEl.style.transform = `rotate(${angle}deg)`;
            this.centsValEl.textContent = `${result.cents > 0 ? '+' : ''}${result.cents}¢`;
            this.centsValEl.style.color = Math.abs(result.cents) < 10 ? '#10b981' : '#f59e0b';

            if (this.diagnosticEl) {
                this.diagnosticEl.textContent = `✓ Detected: ${result.noteName} (${Math.round(result.freq)} Hz)`;
                this.diagnosticEl.style.color = '#38bdf8';
            }
        } else {
            this.resetHUD(result?.status);
        }
    }

    resetHUD(status = null) {
        this.currentNoteEl.textContent = '---';
        this.currentFreqEl.textContent = '0 Hz';
        this.centsNeedleEl.style.transform = 'rotate(0deg)';
        this.centsValEl.textContent = '0¢';
        this.centsValEl.style.color = '#94a3b8';

        if (this.diagnosticEl) {
            if (status === 'too_quiet') {
                this.diagnosticEl.textContent = 'Sound too quiet — increase Mic Gain or play louder';
                this.diagnosticEl.style.color = '#f59e0b';
            } else if (status === 'noisy_or_unclear') {
                this.diagnosticEl.textContent = 'Room noise or multiple chords detected';
                this.diagnosticEl.style.color = '#94a3b8';
            } else {
                this.diagnosticEl.textContent = 'Listening... (play a note or sing)';
                this.diagnosticEl.style.color = '#64748b';
            }
        }
    }

    drawWaveform(buffer) {
        if (!this.waveWidth || !this.waveHeight) this.resizeWaveform();
        const ctx = this.waveformCtx;
        const w = this.waveWidth;
        const h = this.waveHeight;

        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();

        const sliceWidth = w / buffer.length;
        let x = 0;

        for (let i = 0; i < buffer.length; i++) {
            const v = buffer[i] * 1.5;
            const y = (0.5 + v * 0.45) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
        }

        ctx.stroke();
    }

    updateStats() {
        this.statsNotesCountEl.textContent = `${this.transcribedNotes.length} Notes`;
        if (this.transcribedNotes.length > 0) {
            const last = this.transcribedNotes[this.transcribedNotes.length - 1];
            const dur = last.startTime + last.duration;
            this.statsDurationEl.textContent = `${dur.toFixed(1)}s`;
        } else {
            this.statsDurationEl.textContent = '0.0s';
        }
    }

    // ==========================================
    // EXPORTS
    // ==========================================
    exportMidi() {
        if (this.transcribedNotes.length === 0) {
            alert('No notes to export! Record or transcribe audio first.');
            return;
        }
        const blob = MidiWriter.encode(this.transcribedNotes, this.transcriber.bpm);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NoteScribe_${Date.now()}.mid`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // SHEET MUSIC PRINTING & PDF EXPORT
    // ==========================================
    openPrintModal() {
        if (this.transcribedNotes.length === 0) {
            alert('No notes transcribed yet to print! Please listen to audio or load a demo song first.');
            return;
        }

        const modal = document.getElementById('print-modal');
        if (modal) {
            modal.style.display = 'flex';
            this.refreshPrintScore();
        }
    }

    closePrintModal() {
        const modal = document.getElementById('print-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    refreshPrintScore() {
        const paper = document.getElementById('printable-score-paper');
        if (!paper || !window.scorePrinter) return;

        const showLabels = document.getElementById('print-labels-toggle')?.checked ?? true;
        const measuresVal = parseInt(document.getElementById('print-measures-per-line')?.value, 10) || 4;

        window.scorePrinter.generatePrintableScore(
            paper,
            this.transcribedNotes,
            this.transcriber.bpm,
            {
                measuresPerSystem: measuresVal,
                showLabels: showLabels
            }
        );
    }

    exportJson() {
        if (this.transcribedNotes.length === 0) {
            alert('No notes to export!');
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.transcribedNotes, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `transcribed_notes_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.noteScribeApp = new NoteScribeApp();
});
