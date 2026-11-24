/**
 * Demo Audio Generator for NoteScribe
 * Synthesizes acoustic audio tracks on the fly into AudioBuffers for instant 1-click testing.
 */

class DemoSongGenerator {
    static DEMO_TRACKS = [
        {
            id: 'ode_to_joy',
            title: 'Ode to Joy - Beethoven',
            notes: [
                { midi: 64, dur: 0.5 }, { midi: 64, dur: 0.5 }, { midi: 65, dur: 0.5 }, { midi: 67, dur: 0.5 },
                { midi: 67, dur: 0.5 }, { midi: 65, dur: 0.5 }, { midi: 64, dur: 0.5 }, { midi: 62, dur: 0.5 },
                { midi: 60, dur: 0.5 }, { midi: 60, dur: 0.5 }, { midi: 62, dur: 0.5 }, { midi: 64, dur: 0.5 },
                { midi: 64, dur: 0.75 }, { midi: 62, dur: 0.25 }, { midi: 62, dur: 1.0 }
            ]
        },
        {
            id: 'fur_elise',
            title: 'Für Elise - Beethoven',
            notes: [
                { midi: 76, dur: 0.3 }, { midi: 75, dur: 0.3 }, { midi: 76, dur: 0.3 }, { midi: 75, dur: 0.3 },
                { midi: 76, dur: 0.3 }, { midi: 71, dur: 0.3 }, { midi: 74, dur: 0.3 }, { midi: 72, dur: 0.3 },
                { midi: 69, dur: 0.8 }, { midi: 60, dur: 0.3 }, { midi: 64, dur: 0.3 }, { midi: 69, dur: 0.3 },
                { midi: 71, dur: 0.8 }, { midi: 64, dur: 0.3 }, { midi: 68, dur: 0.3 }, { midi: 71, dur: 0.3 },
                { midi: 72, dur: 0.8 }
            ]
        },
        {
            id: 'twinkle',
            title: 'Twinkle Twinkle Little Star',
            notes: [
                { midi: 60, dur: 0.5 }, { midi: 60, dur: 0.5 }, { midi: 67, dur: 0.5 }, { midi: 67, dur: 0.5 },
                { midi: 69, dur: 0.5 }, { midi: 69, dur: 0.5 }, { midi: 67, dur: 1.0 },
                { midi: 65, dur: 0.5 }, { midi: 65, dur: 0.5 }, { midi: 64, dur: 0.5 }, { midi: 64, dur: 0.5 },
                { midi: 62, dur: 0.5 }, { midi: 62, dur: 0.5 }, { midi: 60, dur: 1.0 }
            ]
        },
        {
            id: 'scale',
            title: 'C Major Scale & Arpeggio',
            notes: [
                { midi: 60, dur: 0.4 }, { midi: 62, dur: 0.4 }, { midi: 64, dur: 0.4 }, { midi: 65, dur: 0.4 },
                { midi: 67, dur: 0.4 }, { midi: 69, dur: 0.4 }, { midi: 71, dur: 0.4 }, { midi: 72, dur: 0.8 },
                { midi: 67, dur: 0.4 }, { midi: 64, dur: 0.4 }, { midi: 60, dur: 1.0 }
            ]
        }
    ];

    /**
     * Synthesize clean acoustic audio buffer with natural string harmonics & envelope
     */
    static generateAudioBuffer(audioCtx, trackId) {
        const track = DemoSongGenerator.DEMO_TRACKS.find(t => t.id === trackId) || DemoSongGenerator.DEMO_TRACKS[0];
        const sampleRate = audioCtx.sampleRate;

        // Compute total duration
        let totalDuration = 0.5;
        track.notes.forEach(n => totalDuration += n.dur);
        totalDuration += 1.0;

        const buffer = audioCtx.createBuffer(1, Math.floor(sampleRate * totalDuration), sampleRate);
        const data = buffer.getChannelData(0);

        let currentOffset = 0.3; // 300ms initial silence
        track.notes.forEach(n => {
            const freq = 440 * Math.pow(2, (n.midi - 69) / 12);
            const noteSamples = Math.floor(sampleRate * n.dur);
            const startIdx = Math.floor(sampleRate * currentOffset);

            for (let i = 0; i < noteSamples; i++) {
                const t = i / sampleRate;
                // Physical modeling decay envelope
                const env = Math.exp(-t * 2.8) * Math.min(1.0, t / 0.005);
                // Multi-harmonic string tone
                const s1 = Math.sin(2 * Math.PI * freq * t);
                const s2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.45;
                const s3 = Math.sin(2 * Math.PI * freq * 3 * t) * 0.2;
                const sample = (s1 + s2 + s3) * env * 0.35;

                if (startIdx + i < data.length) {
                    data[startIdx + i] += sample;
                }
            }

            currentOffset += n.dur;
        });

        return {
            buffer: buffer,
            title: track.title,
            duration: totalDuration
        };
    }
}

window.DemoSongGenerator = DemoSongGenerator;
