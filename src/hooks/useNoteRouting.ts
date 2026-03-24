import { useRef, useCallback, useEffect } from 'react';
import { NoteManager } from '../engine/audio/NoteManager';
import { VoiceAllocator } from '../engine/audio/VoiceAllocator';
import { LatchEngine } from '../engine/sequencer/LatchEngine';
import { ArpeggiatorEngine } from '../engine/sequencer/ArpeggiatorEngine';
import { SequencerEngine } from '../engine/sequencer/SequencerEngine';
import type { AudioGraph } from '../engine/audio/AudioGraph';

interface UseNoteRoutingOptions {
  graphRef: React.RefObject<AudioGraph | null>;
  ensureAudioContext: () => void;
}

export function useNoteRouting({ graphRef, ensureAudioContext }: UseNoteRoutingOptions) {
  const noteManagerRef = useRef<NoteManager | null>(null);
  const voiceAllocatorRef = useRef<VoiceAllocator | null>(null);
  const latchRef = useRef<LatchEngine | null>(null);
  const arpRef = useRef<ArpeggiatorEngine | null>(null);
  const seqRef = useRef<SequencerEngine | null>(null);

  useEffect(() => {
    const nm = new NoteManager();
    const va = new VoiceAllocator(2);
    noteManagerRef.current = nm;
    voiceAllocatorRef.current = va;

    nm.onNoteEvent((event) => {
      if (event.type === 'note-on') {
        va.allocate(event.noteNumber, event.velocity);
      } else {
        va.release(event.noteNumber);
      }
    });

    const latchEng = new LatchEngine({
      onNoteOn: (n: number, v: number) => graphRef.current?.triggerNoteOn(n, v),
      onNoteOff: (n: number) => graphRef.current?.triggerNoteOff(n),
    });
    latchRef.current = latchEng;

    const arpEng = new ArpeggiatorEngine({
      onNoteOn: (n: number, v: number) => graphRef.current?.triggerNoteOn(n, v),
      onNoteOff: (n: number) => graphRef.current?.triggerNoteOff(n),
    });
    arpRef.current = arpEng;

    const seqEng = new SequencerEngine({
      onNoteOn: (n: number, v: number) => graphRef.current?.triggerNoteOn(n, v),
      onNoteOff: (n: number) => graphRef.current?.triggerNoteOff(n),
      onStateChange: () => {},
      onPositionChange: () => {},
    });
    seqRef.current = seqEng;
  }, [graphRef]);

  const handleNoteOn = useCallback((noteNumber: number, velocity: number) => {
    ensureAudioContext();
    noteManagerRef.current?.triggerNoteOn(noteNumber, velocity, 'keyboard');
    graphRef.current?.triggerNoteOn(noteNumber, velocity);
    latchRef.current?.handleNoteOn(noteNumber, velocity);
    if (arpRef.current?.isEnabled()) {
      arpRef.current.addNote(noteNumber, velocity);
    }
    if (seqRef.current?.getState() === 'recording') {
      seqRef.current.handleNoteEvent({ type: 'note-on', noteNumber, velocity, timestamp: 0 });
    }
  }, [ensureAudioContext, graphRef]);

  const handleNoteOff = useCallback((noteNumber: number) => {
    noteManagerRef.current?.triggerNoteOff(noteNumber, 'keyboard');
    graphRef.current?.triggerNoteOff(noteNumber);
    latchRef.current?.handleNoteOff(noteNumber);
    if (arpRef.current?.isEnabled()) {
      arpRef.current.removeNote(noteNumber);
    }
    if (seqRef.current?.getState() === 'recording') {
      seqRef.current.handleNoteEvent({ type: 'note-off', noteNumber, velocity: 0, timestamp: 0 });
    }
  }, [graphRef]);

  const handleDragStart = useCallback((_typeId: string) => {
    ensureAudioContext();
  }, [ensureAudioContext]);

  return {
    noteManagerRef,
    voiceAllocatorRef,
    latchRef,
    arpRef,
    seqRef,
    handleNoteOn,
    handleNoteOff,
    handleDragStart,
  };
}
