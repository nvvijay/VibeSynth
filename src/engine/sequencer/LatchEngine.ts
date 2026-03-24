import type { LatchCallbacks } from '../../types';

export class LatchEngine {
  private callbacks: LatchCallbacks;
  private enabled = false;
  private latched = new Map<number, number>(); // noteNumber → velocity

  constructor(callbacks: LatchCallbacks) {
    this.callbacks = callbacks;
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled && !enabled) {
      // Release all latched notes
      for (const noteNumber of this.latched.keys()) {
        this.callbacks.onNoteOff(noteNumber);
      }
      this.latched.clear();
    }
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  handleNoteOn(noteNumber: number, velocity: number): void {
    if (noteNumber < 0 || noteNumber > 127) return;
    if (!this.enabled) {
      this.callbacks.onNoteOn(noteNumber, velocity);
      return;
    }
    // Toggle: if already latched, release it
    if (this.latched.has(noteNumber)) {
      this.latched.delete(noteNumber);
      this.callbacks.onNoteOff(noteNumber);
    } else {
      this.latched.set(noteNumber, velocity);
      this.callbacks.onNoteOn(noteNumber, velocity);
    }
  }

  handleNoteOff(noteNumber: number): void {
    if (noteNumber < 0 || noteNumber > 127) return;
    if (!this.enabled) {
      this.callbacks.onNoteOff(noteNumber);
      return;
    }
    // When latch is enabled, suppress note-off (note stays latched)
  }

  getLatchedNotes(): number[] {
    return Array.from(this.latched.keys());
  }
}
