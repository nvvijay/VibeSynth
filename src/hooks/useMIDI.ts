import { useState, useRef, useEffect } from 'react';
import { MIDIManager } from '../engine/midi/MIDIManager';
import type { NoteManager } from '../engine/audio/NoteManager';
import type { AudioGraph } from '../engine/audio/AudioGraph';

interface UseMIDIOptions {
  noteManagerRef: React.RefObject<NoteManager | null>;
  graphRef: React.RefObject<AudioGraph | null>;
}

export function useMIDI({ noteManagerRef, graphRef }: UseMIDIOptions) {
  const midiManagerRef = useRef<MIDIManager | null>(null);
  const [midiStatus, setMidiStatus] = useState('');

  useEffect(() => {
    const midi = new MIDIManager();
    midiManagerRef.current = midi;

    if (midi.isSupported()) {
      midi.onNoteEvent((event) => {
        if (event.type === 'note-on') {
          noteManagerRef.current?.triggerNoteOn(event.noteNumber, event.velocity, 'midi');
          graphRef.current?.triggerNoteOn(event.noteNumber, event.velocity);
        } else {
          noteManagerRef.current?.triggerNoteOff(event.noteNumber, 'midi');
          graphRef.current?.triggerNoteOff(event.noteNumber);
        }
      });
      midi.onDeviceChange((devices) => {
        const connected = devices.filter((d) => d.connected);
        setMidiStatus(connected.length > 0 ? `MIDI: ${connected[0].name}` : '');
      });
      midi.init().catch(() => {
        setMidiStatus('MIDI unavailable');
      });
    }

    return () => {
      midi.destroy();
    };
  }, [noteManagerRef, graphRef]);

  return { midiManagerRef, midiStatus };
}
