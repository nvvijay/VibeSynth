import type { ArpPattern, ArpeggiatorCallbacks } from '../../types';
import { clampBpm, stepIntervalMs } from './sequencer-utils';

interface PoolEntry {
  noteNumber: number;
  velocity: number;
}

export class ArpeggiatorEngine {
  private callbacks: ArpeggiatorCallbacks;
  private enabled = false;
  private pattern: ArpPattern = 'up';
  private bpm = 120;
  private stepsPerBeat = 4;
  private pool: PoolEntry[] = [];
  private cycling = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentIndex = 0;
  private lastPlayedNote: number | null = null;

  constructor(callbacks: ArpeggiatorCallbacks) {
    this.callbacks = callbacks;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setPattern(pattern: ArpPattern): void {
    this.pattern = pattern;
    this.currentIndex = 0;
  }

  getPattern(): ArpPattern {
    return this.pattern;
  }

  setBpm(bpm: number): void {
    const clamped = clampBpm(bpm);
    if (clamped === null) return;
    this.bpm = clamped;
    if (this.cycling) {
      this.stopInterval();
      this.startInterval();
    }
  }

  setStepResolution(division: number): void {
    this.stepsPerBeat = division;
    if (this.cycling) {
      this.stopInterval();
      this.startInterval();
    }
  }

  addNote(noteNumber: number, velocity: number): void {
    if (noteNumber < 0 || noteNumber > 127) return;
    // Don't add duplicates
    if (this.pool.find(e => e.noteNumber === noteNumber)) return;
    this.pool.push({ noteNumber, velocity });
    this.pool.sort((a, b) => a.noteNumber - b.noteNumber);
    if (this.enabled && this.pool.length > 0 && !this.cycling) {
      this.start();
    }
  }

  removeNote(noteNumber: number): void {
    this.pool = this.pool.filter(e => e.noteNumber !== noteNumber);
    if (this.pool.length === 0 && this.cycling) {
      if (this.lastPlayedNote !== null) {
        this.callbacks.onNoteOff(this.lastPlayedNote);
        this.lastPlayedNote = null;
      }
      this.stopInterval();
      this.cycling = false;
    } else if (this.cycling) {
      // Adjust index if needed
      if (this.currentIndex >= this.pool.length) {
        this.currentIndex = 0;
      }
    }
  }

  getNotePool(): number[] {
    return this.pool.map(e => e.noteNumber);
  }

  start(): void {
    if (this.pool.length === 0) return;
    this.cycling = true;
    this.currentIndex = 0;
    this.step();
    this.startInterval();
  }

  stop(): void {
    if (this.lastPlayedNote !== null) {
      this.callbacks.onNoteOff(this.lastPlayedNote);
      this.lastPlayedNote = null;
    }
    this.stopInterval();
    this.cycling = false;
    this.currentIndex = 0;
  }

  private startInterval(): void {
    const ms = stepIntervalMs(this.bpm, this.stepsPerBeat);
    this.intervalId = setInterval(() => this.step(), ms);
  }

  private stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private step(): void {
    if (this.pool.length === 0) return;

    // Note-off previous
    if (this.lastPlayedNote !== null) {
      this.callbacks.onNoteOff(this.lastPlayedNote);
    }

    const entry = this.getNextNote();
    this.lastPlayedNote = entry.noteNumber;
    this.callbacks.onNoteOn(entry.noteNumber, entry.velocity);
  }

  private getNextNote(): PoolEntry {
    const sorted = [...this.pool].sort((a, b) => a.noteNumber - b.noteNumber);

    switch (this.pattern) {
      case 'up': {
        const idx = this.currentIndex % sorted.length;
        this.currentIndex = (this.currentIndex + 1) % sorted.length;
        return sorted[idx];
      }
      case 'down': {
        const reversed = [...sorted].reverse();
        const idx = this.currentIndex % reversed.length;
        this.currentIndex = (this.currentIndex + 1) % reversed.length;
        return reversed[idx];
      }
      case 'up-down': {
        if (sorted.length === 1) return sorted[0];
        // Build sequence: [0,1,...,n-1, n-2,...,1] (no endpoint repeats)
        const seq: number[] = [];
        for (let i = 0; i < sorted.length; i++) seq.push(i);
        for (let i = sorted.length - 2; i >= 1; i--) seq.push(i);
        const idx = this.currentIndex % seq.length;
        this.currentIndex = (this.currentIndex + 1) % seq.length;
        return sorted[seq[idx]];
      }
      case 'random': {
        const idx = Math.floor(Math.random() * sorted.length);
        return sorted[idx];
      }
      default:
        return sorted[0];
    }
  }
}
