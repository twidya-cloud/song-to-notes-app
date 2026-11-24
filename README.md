# 𝄞 NoteScribe - Listen to a Song & Draw the Notes

A web application that listens to live microphone audio or uploaded song files (MP3/WAV), detects the musical pitches in real time, and automatically transcribes and draws the notes onto an interactive **Musical Grand Staff (Sheet Music)** and **Piano Roll Timeline**.

---

## 🌟 Key Features

### 1. 🎙️ Real-Time Microphone Listening
- Sing, hum, whistle, or play your instrument (piano, guitar, violin, flute) directly into your microphone.
- NoteScribe detects the fundamental pitch ($f_0$) and immediately draws the notes on the sheet music staff as you perform!

### 2. 📁 Audio File Upload & Automatic Transcription
- Drag & drop or upload any recorded audio file (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.aac`).
- Automatically analyzes the entire song, segments pitches into notes, and renders the complete sheet music score.

### 3. 🎼 Built-In Demo Tracks (1-Click Instant Testing)
- Built-in classical & pop melodies (*Für Elise*, *Ode to Joy*, *Twinkle Twinkle Little Star*, *Major Scale & Arpeggios*) to test audio transcription without needing a microphone.

### 4. 🎛️ Dual Notation Visualizers
- **Musical Grand Staff (Sheet Music)**:
  - Treble Clef ($\oint$) & Bass Clef ($\wp$).
  - Correct placement of note heads, ledger lines, accidentals ($\sharp$/$\flat$), and stems.
  - Measure barlines and measure numbering (M1, M2, M3...).
  - Synchronized glowing cyan playhead cursor.
  - **Interactive Audition**: Click any note on the sheet music to hear its pitch!
- **Piano Roll & Melody Timeline**:
  - Horizontal pitch vs. time grid with piano ruler on the left.
  - Colorful note blocks reflecting note durations.

### 5. 🎯 Pitch Accuracy & Tuner HUD
- Real-time detected note badge (e.g. `C4`, `F#5`).
- Exact frequency in Hertz (Hz).
- Tuner cents needle gauge (-50¢ to +50¢).
- Live oscilloscope waveform display.

### 6. 💾 Export Options
- **Export to Standard MIDI (`.mid`)**: Download standard MIDI files compatible with GarageBand, Logic Pro, Ableton Live, MuseScore, or Sibelius.
- **Print / Save PDF Sheet Music**: Formatted for printing or saving clean sheet music to PDF.
- **Export JSON**: Raw note timing, duration, and pitch metadata.

---

## 🚀 How to Run

### In Browser:
Open `index.html` in Safari, Google Chrome, Brave, or Edge:
```bash
open /Users/tomy/song-to-notes-app/index.html
```

### Or using the Launcher script:
```bash
cd /Users/tomy/song-to-notes-app && ./run.sh
```

---

## 🔬 How Pitch Detection Works
NoteScribe uses a multi-stage DSP pipeline:
1. **Normalized Autocorrelation & Square Difference Function (YIN/MPM-derived)**: Extracts fundamental pitch with sub-sample accuracy via parabolic peak interpolation.
2. **RMS Energy Gate & Onset Detection**: Separates genuine musical notes from background noise and detects note re-attacks.
3. **Musical Quantization**: Aligns notes to rhythmic values (quarter, eighth, half, whole notes) and measures based on the project tempo (BPM).
