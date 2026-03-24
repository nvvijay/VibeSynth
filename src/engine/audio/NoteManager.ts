import type { NoteEvent } from '../../types';

type NoteEventCallback = (event: NoteEvent) => void;

export class NoteManager {
  private listeners: NoteEventCallback[] = [];

  onNoteEvent(callback: NoteEventCallback): void {
    this.listeners.push(callback);
  }

  triggerNoteOn(
    noteNumber: number,
    velocity: number,
    source: 'keyboard' | 'midi',
  ): void {
    const event: NoteEvent = {
      type: 'note-on',
      noteNumber,
      velocity,
      source,
    };
    this.emit(event);
  }

  triggerNoteOff(noteNumber: number, source: 'keyboard' | 'midi'): void {
    const event: NoteEvent = {
      type: 'note-off',
      noteNumber,
      velocity: 0,
      source,
    };
    this.emit(event);
  }

  private emit(event: NoteEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
