/**
 * Pure JavaScript Standard MIDI File (SMF) Encoder
 * Exports transcribed notes to standard .mid files for DAWs & sheet music editors.
 */

class MidiWriter {
    static encode(notes, bpm = 100) {
        const ticksPerQuarterNote = 480;
        const secondsPerQuarterNote = 60.0 / bpm;
        const ticksPerSecond = ticksPerQuarterNote / secondsPerQuarterNote;

        // Build list of MIDI events (Note On / Note Off) sorted by tick time
        const rawEvents = [];

        notes.forEach(note => {
            const startTick = Math.round(note.startTime * ticksPerSecond);
            const durationTicks = Math.max(120, Math.round(note.duration * ticksPerSecond));
            const endTick = startTick + durationTicks;
            const velocity = Math.min(127, Math.max(20, Math.round((note.velocity || 0.8) * 127)));

            rawEvents.push({
                tick: startTick,
                type: 0x90, // Note On
                channel: 0,
                param1: note.midi,
                param2: velocity
            });

            rawEvents.push({
                tick: endTick,
                type: 0x80, // Note Off
                channel: 0,
                param1: note.midi,
                param2: 0
            });
        });

        // Sort events chronologically (Note Off before Note On if at same tick)
        rawEvents.sort((a, b) => {
            if (a.tick !== b.tick) return a.tick - b.tick;
            return a.type - b.type;
        });

        // Build Track Chunk data with delta times
        const trackBytes = [];

        // Meta event: Set Tempo (microsec per quarter note = 60,000,000 / BPM)
        const mpqn = Math.round(60000000 / bpm);
        trackBytes.push(0x00); // delta-time 0
        trackBytes.push(0xFF, 0x51, 0x03);
        trackBytes.push((mpqn >> 16) & 0xFF, (mpqn >> 8) & 0xFF, mpqn & 0xFF);

        let lastTick = 0;
        for (const evt of rawEvents) {
            const delta = evt.tick - lastTick;
            lastTick = evt.tick;

            MidiWriter.writeVarLength(delta, trackBytes);
            trackBytes.push(evt.type | (evt.channel & 0x0F));
            trackBytes.push(evt.param1 & 0x7F);
            trackBytes.push(evt.param2 & 0x7F);
        }

        // End of Track meta-event
        trackBytes.push(0x00, 0xFF, 0x2F, 0x00);

        // Header Chunk: 'MThd' (4 bytes), length = 6, format = 0, tracks = 1, division = 480
        const headerBytes = [
            0x4D, 0x54, 0x68, 0x64, // MThd
            0x00, 0x00, 0x00, 0x06, // length 6
            0x00, 0x00,             // format 0
            0x00, 0x01,             // 1 track
            (ticksPerQuarterNote >> 8) & 0xFF, ticksPerQuarterNote & 0xFF
        ];

        // Track Header: 'MTrk' (4 bytes), length of track data
        const trackLength = trackBytes.length;
        const trackHeaderBytes = [
            0x4D, 0x54, 0x72, 0x6B, // MTrk
            (trackLength >> 24) & 0xFF,
            (trackLength >> 16) & 0xFF,
            (trackLength >> 8) & 0xFF,
            trackLength & 0xFF
        ];

        const allBytes = new Uint8Array(headerBytes.length + trackHeaderBytes.length + trackBytes.length);
        allBytes.set(headerBytes, 0);
        allBytes.set(trackHeaderBytes, headerBytes.length);
        allBytes.set(trackBytes, headerBytes.length + trackHeaderBytes.length);

        return new Blob([allBytes], { type: 'audio/midi' });
    }

    static writeVarLength(value, bytesArray) {
        let buffer = value & 0x7F;
        while ((value >>= 7) > 0) {
            buffer <<= 8;
            buffer |= 0x80;
            buffer += (value & 0x7F);
        }
        while (true) {
            bytesArray.push(buffer & 0xFF);
            if (buffer & 0x80) {
                buffer >>= 8;
            } else {
                break;
            }
        }
    }
}

window.MidiWriter = MidiWriter;
