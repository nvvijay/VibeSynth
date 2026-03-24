// Shared utility functions for the MIDI Sequencer feature

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Clamp BPM to [20, 300], reject NaN/Infinity */
export function clampBpm(bpm: number): number | null {
  if (!Number.isFinite(bpm)) return null;
  return Math.max(20, Math.min(300, bpm));
}

/** Compute step interval in ms from BPM and steps-per-beat */
export function stepIntervalMs(bpm: number, stepsPerBeat: number): number {
  const clamped = clampBpm(bpm);
  if (clamped === null) return 500; // fallback
  return (60_000 / clamped) / stepsPerBeat;
}

/** Convert MIDI note number (0-127) to label like "C4", "A#3" */
export function midiNoteToLabel(noteNumber: number): string {
  const name = NOTE_NAMES[noteNumber % 12];
  const octave = Math.floor(noteNumber / 12) - 1;
  return `${name}${octave}`;
}

/** Quantize a timestamp to the nearest grid line for a given division */
export type QuantizeDivision = 4 | 8 | 16 | 32;

export function quantizeTimestamp(timestampMs: number, bpm: number, division: QuantizeDivision): number {
  const clamped = clampBpm(bpm);
  if (clamped === null) return timestampMs;
  const gridMs = (60_000 / clamped) / (division / 4); // e.g. 1/4 = beatMs, 1/8 = beatMs/2
  return Math.round(timestampMs / gridMs) * gridMs;
}

/** Compute beat marker positions in ms for a given BPM and duration */
export function computeBeatMarkers(bpm: number, durationMs: number): number[] {
  const clamped = clampBpm(bpm);
  if (clamped === null || durationMs <= 0) return [0];
  const beatMs = 60_000 / clamped;
  const count = Math.floor(durationMs / beatMs) + 1;
  const markers: number[] = [];
  for (let i = 0; i < count; i++) {
    markers.push(i * beatMs);
  }
  return markers;
}
