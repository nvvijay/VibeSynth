import { describe, it, expect, vi } from 'vitest';
import { NoteManager } from '../../src/engine/audio/NoteManager';
import type { NoteEvent } from '../../src/types';

describe('NoteManager', () => {
  it('triggerNoteOn emits a note-on event to all listeners', () => {
    const manager = new NoteManager();
    const received: NoteEvent[] = [];
    manager.onNoteEvent((e) => received.push(e));

    manager.triggerNoteOn(60, 100, 'keyboard');

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      type: 'note-on',
      noteNumber: 60,
      velocity: 100,
      source: 'keyboard',
    });
  });

  it('triggerNoteOff emits a note-off event with velocity 0', () => {
    const manager = new NoteManager();
    const received: NoteEvent[] = [];
    manager.onNoteEvent((e) => received.push(e));

    manager.triggerNoteOff(60, 'midi');

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      type: 'note-off',
      noteNumber: 60,
      velocity: 0,
      source: 'midi',
    });
  });

  it('supports multiple listeners', () => {
    const manager = new NoteManager();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    manager.onNoteEvent(cb1);
    manager.onNoteEvent(cb2);

    manager.triggerNoteOn(72, 80, 'keyboard');

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('emits events with correct source for midi', () => {
    const manager = new NoteManager();
    const received: NoteEvent[] = [];
    manager.onNoteEvent((e) => received.push(e));

    manager.triggerNoteOn(48, 127, 'midi');

    expect(received[0].source).toBe('midi');
  });

  it('does not fail when no listeners are registered', () => {
    const manager = new NoteManager();
    expect(() => manager.triggerNoteOn(60, 100, 'keyboard')).not.toThrow();
    expect(() => manager.triggerNoteOff(60, 'keyboard')).not.toThrow();
  });
});
