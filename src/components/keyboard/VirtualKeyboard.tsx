import { useState, useEffect, useCallback, useRef } from 'react';
import type { Theme } from '../../theme';

// --- Constants ---

/** The 12 semitone offsets within one octave (C=0 through B=11) */
const SEMITONE_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Which semitone offsets are black keys */
const BLACK_KEY_OFFSETS = new Set([1, 3, 6, 8, 10]);

/** Computer keyboard → semitone offset mapping (2 octaves) */
const KEY_MAP: Record<string, number> = {
  a: 0,  w: 1,  s: 2,  e: 3,  d: 4,  f: 5,
  t: 6,  g: 7,  y: 8,  h: 9,  u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';':16,
};

const DEFAULT_VELOCITY = 100;
const MIN_OCTAVE = 0;
const MAX_OCTAVE = 8;

// --- Styles ---

const colors = {
  container: '#E8DFF5',
  whiteKey: '#FFF8F0',
  whiteKeyActive: '#FFB5A7',
  blackKey: '#8B6B8B',
  blackKeyActive: '#F08080',
  octaveBtn: '#B5EAD7',
  octaveBtnHover: '#9DD5C0',
  labelMuted: '#B8A9C9',
  labelBlack: '#D4C4D4',
  shadow: 'rgba(0,0,0,0.12)',
};

// --- Props ---

export interface VirtualKeyboardProps {
  onNoteOn: (noteNumber: number, velocity: number) => void;
  onNoteOff: (noteNumber: number) => void;
  theme: Theme;
}

// --- Component ---

export function VirtualKeyboard({ onNoteOn, onNoteOff, theme }: VirtualKeyboardProps) {
  const [baseOctave, setBaseOctave] = useState(4);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const activeNotesRef = useRef<Set<number>>(new Set());

  // Keep ref in sync for use in keyboard handlers
  useEffect(() => {
    activeNotesRef.current = activeNotes;
  }, [activeNotes]);

  const baseMidi = baseOctave * 12 + 12; // C of the base octave (C4 = 60)

  const c = theme.isDark ? {
    container: '#221e2e',
    whiteKey: '#1e1e34',
    whiteKeyActive: '#8B4A42',
    whiteKeyGradient: '#16162a',
    blackKey: '#5A4A6E',
    blackKeyActive: '#8B4A42',
    blackKeyGradient: '#3a2a4e',
    octaveBtn: '#1a2a22',
    octaveBtnText: '#8DD4B8',
    labelMuted: '#8878a0',
    labelBlack: '#a898c0',
    shadow: 'rgba(0,0,0,0.3)',
    keyBorder: '#2e2e4a',
  } : {
    container: colors.container,
    whiteKey: colors.whiteKey,
    whiteKeyActive: colors.whiteKeyActive,
    whiteKeyGradient: '#F5EDE5',
    blackKey: colors.blackKey,
    blackKeyActive: colors.blackKeyActive,
    blackKeyGradient: '#6B4F6B',
    octaveBtn: colors.octaveBtn,
    octaveBtnText: '#5A7A6A',
    labelMuted: colors.labelMuted,
    labelBlack: colors.labelBlack,
    shadow: colors.shadow,
    keyBorder: '#E0D5CC',
  };

  const noteOn = useCallback((noteNumber: number) => {
    if (noteNumber < 0 || noteNumber > 127) return;
    if (activeNotesRef.current.has(noteNumber)) return;
    setActiveNotes((prev) => new Set(prev).add(noteNumber));
    onNoteOn(noteNumber, DEFAULT_VELOCITY);
  }, [onNoteOn]);

  const noteOff = useCallback((noteNumber: number) => {
    if (!activeNotesRef.current.has(noteNumber)) return;
    setActiveNotes((prev) => {
      const next = new Set(prev);
      next.delete(noteNumber);
      return next;
    });
    onNoteOff(noteNumber);
  }, [onNoteOff]);

  // --- Computer keyboard handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const offset = KEY_MAP[e.key.toLowerCase()];
      if (offset === undefined) return;
      const noteNumber = baseMidi + offset;
      noteOn(noteNumber);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const offset = KEY_MAP[e.key.toLowerCase()];
      if (offset === undefined) return;
      const noteNumber = baseMidi + offset;
      noteOff(noteNumber);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [baseMidi, noteOn, noteOff]);

  // --- Octave shift ---
  const shiftOctave = (delta: number) => {
    setBaseOctave((prev) => Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, prev + delta)));
  };

  // --- Build key data for 2 octaves ---
  const keys: Array<{ noteNumber: number; isBlack: boolean; label: string }> = [];
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  for (let octave = 0; octave < 2; octave++) {
    for (const offset of SEMITONE_OFFSETS) {
      const noteNumber = baseMidi + octave * 12 + offset;
      if (noteNumber > 127) break;
      keys.push({
        noteNumber,
        isBlack: BLACK_KEY_OFFSETS.has(offset),
        label: noteNames[offset],
      });
    }
  }

  const whiteKeys = keys.filter((k) => !k.isBlack);
  const blackKeys = keys.filter((k) => k.isBlack);

  // Compute black key positions relative to white keys
  // Black keys sit between specific white keys
  const blackKeyPositions = blackKeys.map((bk) => {
    // Find the index of the white key just before this black key
    const whiteIndex = whiteKeys.findIndex((wk) => wk.noteNumber === bk.noteNumber - 1);
    return { ...bk, whiteIndex };
  });

  const whiteKeyWidth = 48;
  const whiteKeyHeight = 144;
  const blackKeyWidth = 30;
  const blackKeyHeight = 88;
  const totalWidth = whiteKeys.length * whiteKeyWidth;

  // Find computer key label for a given note
  const getComputerKey = (noteNumber: number): string | null => {
    const offset = noteNumber - baseMidi;
    const entry = Object.entries(KEY_MAP).find(([, v]) => v === offset);
    return entry ? entry[0].toUpperCase() : null;
  };

  return (
    <div
      style={{
        background: c.container,
        borderRadius: 16,
        padding: '12px 20px 16px',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        boxShadow: `0 4px 20px ${c.shadow}`,
        userSelect: 'none',
      }}
      role="group"
      aria-label="Virtual Piano Keyboard"
    >
      {/* Octave controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => shiftOctave(-1)}
          disabled={baseOctave <= MIN_OCTAVE}
          aria-label="Shift octave down"
          style={{
            background: c.octaveBtn,
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 18,
            cursor: baseOctave <= MIN_OCTAVE ? 'not-allowed' : 'pointer',
            opacity: baseOctave <= MIN_OCTAVE ? 0.5 : 1,
            fontWeight: 600,
            color: c.octaveBtnText,
            transition: 'background 0.15s',
          }}
        >
          ◀
        </button>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: theme.textHeading,
            minWidth: 80,
            textAlign: 'center',
          }}
        >
          Octave {baseOctave}
        </span>
        <button
          onClick={() => shiftOctave(1)}
          disabled={baseOctave >= MAX_OCTAVE}
          aria-label="Shift octave up"
          style={{
            background: c.octaveBtn,
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 18,
            cursor: baseOctave >= MAX_OCTAVE ? 'not-allowed' : 'pointer',
            opacity: baseOctave >= MAX_OCTAVE ? 0.5 : 1,
            fontWeight: 600,
            color: c.octaveBtnText,
            transition: 'background 0.15s',
          }}
        >
          ▶
        </button>
      </div>

      {/* Piano keys */}
      <div
        style={{
          position: 'relative',
          width: totalWidth,
          height: whiteKeyHeight,
        }}
      >
        {/* White keys */}
        {whiteKeys.map((key, i) => {
          const isActive = activeNotes.has(key.noteNumber);
          const computerKey = getComputerKey(key.noteNumber);
          return (
            <div
              key={key.noteNumber}
              role="button"
              aria-label={`${key.label} ${baseOctave + Math.floor((key.noteNumber - baseMidi) / 12)}`}
              aria-pressed={isActive}
              onMouseDown={() => noteOn(key.noteNumber)}
              onMouseUp={() => noteOff(key.noteNumber)}
              onMouseLeave={() => { if (isActive) noteOff(key.noteNumber); }}
              onTouchStart={(e) => { e.preventDefault(); noteOn(key.noteNumber); }}
              onTouchEnd={(e) => { e.preventDefault(); noteOff(key.noteNumber); }}
              style={{
                position: 'absolute',
                left: i * whiteKeyWidth,
                top: 0,
                width: whiteKeyWidth - 2,
                height: whiteKeyHeight,
                background: isActive
                  ? c.whiteKeyActive
                  : `linear-gradient(to bottom, ${c.whiteKey}, ${c.whiteKeyGradient})`,
                border: `1px solid ${c.keyBorder}`,
                borderRadius: '0 0 6px 6px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 8,
                boxShadow: isActive
                  ? 'inset 0 2px 6px rgba(0,0,0,0.1)'
                  : '0 2px 4px rgba(0,0,0,0.08)',
                transition: 'background 0.08s, box-shadow 0.08s',
                zIndex: 1,
              }}
            >
              {computerKey && (
                <span style={{ fontSize: 10, color: c.labelMuted, marginBottom: 2 }}>
                  {computerKey}
                </span>
              )}
              <span style={{ fontSize: 11, color: c.labelMuted, fontWeight: 500 }}>
                {key.label}
              </span>
            </div>
          );
        })}

        {/* Black keys */}
        {blackKeyPositions.map((key) => {
          const isActive = activeNotes.has(key.noteNumber);
          const computerKey = getComputerKey(key.noteNumber);
          return (
            <div
              key={key.noteNumber}
              role="button"
              aria-label={`${key.label} ${baseOctave + Math.floor((key.noteNumber - baseMidi) / 12)}`}
              aria-pressed={isActive}
              onMouseDown={() => noteOn(key.noteNumber)}
              onMouseUp={() => noteOff(key.noteNumber)}
              onMouseLeave={() => { if (isActive) noteOff(key.noteNumber); }}
              onTouchStart={(e) => { e.preventDefault(); noteOn(key.noteNumber); }}
              onTouchEnd={(e) => { e.preventDefault(); noteOff(key.noteNumber); }}
              style={{
                position: 'absolute',
                left: (key.whiteIndex + 1) * whiteKeyWidth - blackKeyWidth / 2 - 1,
                top: 0,
                width: blackKeyWidth,
                height: blackKeyHeight,
                background: isActive
                  ? c.blackKeyActive
                  : `linear-gradient(to bottom, ${c.blackKey}, ${c.blackKeyGradient})`,
                border: 'none',
                borderRadius: '0 0 4px 4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 6,
                boxShadow: isActive
                  ? 'inset 0 2px 4px rgba(0,0,0,0.2)'
                  : '0 3px 6px rgba(0,0,0,0.2)',
                transition: 'background 0.08s, box-shadow 0.08s',
                zIndex: 2,
              }}
            >
              {computerKey && (
                <span style={{ fontSize: 9, color: c.labelBlack, marginBottom: 1 }}>
                  {computerKey}
                </span>
              )}
              <span style={{ fontSize: 9, color: c.labelBlack, fontWeight: 500 }}>
                {key.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualKeyboard;
