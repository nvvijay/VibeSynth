import type { TransportState, NoteEventRecord, SequencerCallbacks } from '../../types';
import { clampBpm, quantizeTimestamp } from './sequencer-utils';
import type { QuantizeDivision } from './sequencer-utils';

export class SequencerEngine {
  private callbacks: SequencerCallbacks;
  private state: TransportState = 'stopped';
  private bpm = 120;
  private sequence: NoteEventRecord[] = [];
  private sequenceDurationMs = 0;
  private recordingStartTime = 0;
  private activeNotes = new Set<number>();
  private playbackTimers: ReturnType<typeof setTimeout>[] = [];
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private playbackStartTime = 0;
  private positionInterval: ReturnType<typeof setInterval> | null = null;
  private seekPositionMs = 0;

  constructor(callbacks: SequencerCallbacks) {
    this.callbacks = callbacks;
  }

  record(): void {
    if (this.state === 'recording') return;
    if (this.state === 'playing') this.stop();
    this.state = 'recording';
    this.sequence = [];
    this.sequenceDurationMs = 0;
    this.recordingStartTime = performance.now();
    this.callbacks.onStateChange(this.state);
  }

  play(): void {
    if (this.state === 'recording') {
      this.stopRecording();
      if (this.sequence.length === 0) return;
    }
    if (this.state === 'playing') return;
    if (this.sequence.length === 0) return;
    this.state = 'playing';
    this.callbacks.onStateChange(this.state);
    this.playbackStartTime = performance.now();
    this.schedulePlayback();
    this.startPositionPolling();
  }

  stop(): void {
    if (this.state === 'stopped') return;
    if (this.state === 'recording') {
      this.stopRecording();
    } else if (this.state === 'playing') {
      this.clearPlaybackTimers();
      this.stopPositionPolling();
    }
    // Silence all active notes
    for (const note of this.activeNotes) {
      this.callbacks.onNoteOff(note);
    }
    this.activeNotes.clear();
    this.state = 'stopped';
    this.seekPositionMs = 0;
    this.callbacks.onStateChange(this.state);
    this.callbacks.onPositionChange(0);
  }

  clear(): void {
    if (this.state !== 'stopped') this.stop();
    this.sequence = [];
    this.sequenceDurationMs = 0;
    this.callbacks.onPositionChange(0);
  }

  handleNoteEvent(event: NoteEventRecord): void {
    if (this.state !== 'recording') return;
    if (event.noteNumber < 0 || event.noteNumber > 127) return;
    const timestamp = performance.now() - this.recordingStartTime;
    this.sequence.push({
      type: event.type,
      noteNumber: event.noteNumber,
      velocity: event.velocity,
      timestamp,
    });
  }

  setBpm(bpm: number): void {
    const clamped = clampBpm(bpm);
    if (clamped === null) return;
    this.bpm = clamped;
  }

  getBpm(): number {
    return this.bpm;
  }

  getState(): TransportState {
    return this.state;
  }

  getSequence(): NoteEventRecord[] {
    return [...this.sequence];
  }

  getSequenceDurationMs(): number {
    return this.sequenceDurationMs;
  }

  getPlaybackPositionMs(): number {
    if (this.state !== 'playing') return this.seekPositionMs;
    const elapsed = performance.now() - this.playbackStartTime;
    return this.sequenceDurationMs > 0 ? elapsed % this.sequenceDurationMs : 0;
  }

  /** Seek to a specific position in ms. If playing, reschedules playback from that point. */
  seek(positionMs: number): void {
    const clamped = Math.max(0, Math.min(positionMs, this.sequenceDurationMs));
    this.seekPositionMs = clamped;
    if (this.state === 'playing') {
      // Stop all current notes
      for (const note of this.activeNotes) {
        this.callbacks.onNoteOff(note);
      }
      this.activeNotes.clear();
      this.clearPlaybackTimers();
      this.schedulePlaybackFrom(clamped);
    }
    this.callbacks.onPositionChange(clamped);
  }

  /** Replace the entire sequence (used by interactive piano roll editor) */
  setSequence(seq: NoteEventRecord[]): void {
    if (this.state === 'playing') this.stop();
    this.sequence = seq.sort((a, b) => a.timestamp - b.timestamp);
    // Recalculate duration from the last event
    if (this.sequence.length > 0) {
      const lastTs = this.sequence[this.sequence.length - 1].timestamp;
      if (lastTs > this.sequenceDurationMs) {
        this.sequenceDurationMs = lastTs + 100; // small padding
      }
    }
    this.callbacks.onStateChange(this.state);
  }

  /** Set sequence duration explicitly */
  setSequenceDurationMs(ms: number): void {
    this.sequenceDurationMs = Math.max(0, ms);
  }

  /** Quantize all note-on timestamps to the nearest grid line */
  quantize(division: QuantizeDivision): void {
    if (this.sequence.length === 0) return;
    if (this.state === 'playing') this.stop();
    this.sequence = this.sequence.map(ev => ({
      ...ev,
      timestamp: ev.type === 'note-on'
        ? quantizeTimestamp(ev.timestamp, this.bpm, division)
        : ev.timestamp,
    }));
    // Re-sort by timestamp after quantization
    this.sequence.sort((a, b) => a.timestamp - b.timestamp);
    this.callbacks.onStateChange(this.state);
  }

  private stopRecording(): void {
    const elapsed = performance.now() - this.recordingStartTime;
    if (this.sequence.length === 0) {
      // Discard empty recording
      this.state = 'stopped';
      this.callbacks.onStateChange(this.state);
      return;
    }
    this.sequenceDurationMs = elapsed;
    this.state = 'stopped';
    this.callbacks.onStateChange(this.state);
  }

  private schedulePlayback(): void {
    this.schedulePlaybackFrom(0);
  }

  private schedulePlaybackFrom(fromMs: number): void {
    this.clearPlaybackTimers();
    const now = performance.now();
    this.playbackStartTime = now - fromMs;

    for (const event of this.sequence) {
      if (event.timestamp < fromMs) continue;
      const delay = event.timestamp - fromMs;
      const timer = setTimeout(() => {
        if (this.state !== 'playing') return;
        if (event.type === 'note-on') {
          this.activeNotes.add(event.noteNumber);
          this.callbacks.onNoteOn(event.noteNumber, event.velocity);
        } else {
          this.activeNotes.delete(event.noteNumber);
          this.callbacks.onNoteOff(event.noteNumber);
        }
      }, delay);
      this.playbackTimers.push(timer);
    }

    // Schedule loop restart
    const remaining = this.sequenceDurationMs - fromMs;
    this.loopTimer = setTimeout(() => {
      if (this.state !== 'playing') return;
      this.schedulePlaybackFrom(0);
    }, remaining);
  }

  private clearPlaybackTimers(): void {
    for (const t of this.playbackTimers) clearTimeout(t);
    this.playbackTimers = [];
    if (this.loopTimer !== null) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  private startPositionPolling(): void {
    this.positionInterval = setInterval(() => {
      if (this.state === 'playing') {
        this.callbacks.onPositionChange(this.getPlaybackPositionMs());
      }
    }, 50);
  }

  private stopPositionPolling(): void {
    if (this.positionInterval !== null) {
      clearInterval(this.positionInterval);
      this.positionInterval = null;
    }
  }
}
