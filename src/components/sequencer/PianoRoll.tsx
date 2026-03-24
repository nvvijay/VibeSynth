import React, { useRef, useState, useCallback, useEffect, useMemo, memo } from 'react';
import type { NoteEventRecord } from '../../types';
import type { Theme } from '../../theme';
import { midiNoteToLabel, computeBeatMarkers } from '../../engine/sequencer/sequencer-utils';

interface NoteBar {
  id: string;
  noteNumber: number;
  startMs: number;
  durationMs: number;
  velocity: number;
}

interface PianoRollProps {
  sequence: NoteEventRecord[];
  durationMs: number;
  getPlaybackPositionMs: () => number;
  isPlaying: boolean;
  bpm: number;
  theme: Theme;
  onSequenceChange?: (sequence: NoteEventRecord[]) => void;
  onSeek?: (positionMs: number) => void;
}

const LABEL_WIDTH = 52;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 26;
const MIN_NOTE = 36;
const MAX_NOTE = 84;
const NOTE_RANGE = MAX_NOTE - MIN_NOTE + 1;
const DEFAULT_VELOCITY = 100;
const MIN_NOTE_MS = 50;
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

// Note ID generation uses a ref inside PianoRoll (see component body)

function sequenceToBars(sequence: NoteEventRecord[], durationMs: number, genId: () => string): NoteBar[] {
  const onMap = new Map<number, { start: number; velocity: number }>();
  const bars: NoteBar[] = [];
  for (const ev of sequence) {
    if (ev.type === 'note-on') {
      onMap.set(ev.noteNumber, { start: ev.timestamp, velocity: ev.velocity });
    } else {
      const on = onMap.get(ev.noteNumber);
      if (on) {
        bars.push({ id: genId(), noteNumber: ev.noteNumber, startMs: on.start,
          durationMs: ev.timestamp - on.start, velocity: on.velocity });
        onMap.delete(ev.noteNumber);
      }
    }
  }
  for (const [note, on] of onMap) {
    bars.push({ id: genId(), noteNumber: note, startMs: on.start,
      durationMs: Math.max(MIN_NOTE_MS, durationMs - on.start), velocity: on.velocity });
  }
  return bars;
}

function barsToSequence(bars: NoteBar[]): NoteEventRecord[] {
  const events: NoteEventRecord[] = [];
  for (const bar of bars) {
    events.push({ type: 'note-on', noteNumber: bar.noteNumber, velocity: bar.velocity, timestamp: bar.startMs });
    events.push({ type: 'note-off', noteNumber: bar.noteNumber, velocity: 0, timestamp: bar.startMs + bar.durationMs });
  }
  return events.sort((a, b) => a.timestamp - b.timestamp);
}

// --- Memoized sub-components to avoid re-rendering static parts ---

/** Static grid rows — only re-renders when theme changes */
const GridRows = memo(({ rows, rowBorder, blackRowBg }: {
  rows: { note: number; isBlack: boolean }[];
  rowBorder: string; blackRowBg: string;
}) => (
  <>
    {rows.map(r => (
      <div key={r.note} style={{
        height: ROW_HEIGHT, boxSizing: 'border-box',
        borderBottom: `1px solid ${rowBorder}`,
        background: r.isBlack ? blackRowBg : 'transparent',
      }} />
    ))}
  </>
));

/** Static beat lines — only re-renders when bpm/duration changes */
const BeatLines = memo(({ markers, msToPercent, color }: {
  markers: number[]; msToPercent: (ms: number) => number; color: string;
}) => (
  <>
    {markers.map((ms, i) => (
      <div key={i} style={{
        position: 'absolute', top: 0, bottom: 0,
        left: `${msToPercent(ms)}%`, width: 1,
        background: color, pointerEvents: 'none',
      }} />
    ))}
  </>
));

/** Note label column — only re-renders when theme changes, not on playback tick */
const NoteLabels = memo(({ rows, rowBorder, labelColor, labelBg }: {
  rows: { note: number; label: string }[];
  rowBorder: string; labelColor: string; labelBg: string;
}) => (
  <div style={{ width: LABEL_WIDTH, flexShrink: 0, background: labelBg }}>
    {rows.map(r => (
      <div key={r.note} style={{
        height: ROW_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        paddingRight: 6, fontSize: 10, fontFamily: 'monospace', boxSizing: 'border-box',
        borderBottom: `1px solid ${rowBorder}`, borderRight: `1px solid ${rowBorder}`,
        color: labelColor,
      }}>{r.label}</div>
    ))}
  </div>
));

/** Beat header — only re-renders when bpm/duration changes */
const BeatHeader = memo(({ markers, msToPercent, labelColor, beatLineColor, rowBorder, labelBg }: {
  markers: number[]; msToPercent: (ms: number) => number;
  labelColor: string; beatLineColor: string; rowBorder: string; labelBg: string;
}) => (
  <div style={{ display: 'flex', height: HEADER_HEIGHT, flexShrink: 0 }}>
    <div style={{ width: LABEL_WIDTH, flexShrink: 0, background: labelBg,
      borderBottom: `1px solid ${rowBorder}`, borderRight: `1px solid ${rowBorder}` }} />
    <div style={{ flex: 1, position: 'relative', borderBottom: `1px solid ${rowBorder}`, overflow: 'hidden' }}>
      {markers.map((ms, i) => (
        <span key={i} style={{
          position: 'absolute', left: `${msToPercent(ms)}%`, top: 0, bottom: 0,
          fontSize: 10, fontFamily: 'monospace', color: labelColor,
          display: 'flex', alignItems: 'center', paddingLeft: 3,
          borderLeft: `1px solid ${beatLineColor}`,
        }}>{i + 1}</span>
      ))}
    </div>
  </div>
));

export const PianoRoll: React.FC<PianoRollProps> = ({
  sequence, durationMs, getPlaybackPositionMs, isPlaying, bpm, theme, onSequenceChange, onSeek,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const headCursorRef = useRef<HTMLDivElement>(null);
  const noteIdRef = useRef(0);
  const genId = useCallback(() => `n${noteIdRef.current++}`, []);
  const [bars, setBars] = useState<NoteBar[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<NoteBar[]>([]);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize';
    barId: string;
    startX: number; startY: number;
    origStartMs: number; origNote: number; origDurMs: number;
  } | null>(null);
  const barsRef = useRef<NoteBar[]>([]);
  barsRef.current = bars;

  const effectiveDuration = Math.max(durationMs, 4000);

  useEffect(() => { setBars(sequenceToBars(sequence, durationMs, genId)); }, [sequence, durationMs, genId]);

  // Cursor animation loop — runs at display refresh rate, zero React re-renders
  // Also shows static position when stopped (for seek)
  useEffect(() => {
    const el = cursorRef.current;
    const hel = headCursorRef.current;
    const update = (pct: number, visible: boolean) => {
      if (el) {
        el.style.display = visible ? 'block' : 'none';
        el.style.left = `${pct}%`;
      }
      if (hel) {
        hel.style.display = visible ? 'block' : 'none';
        hel.style.left = `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px) * ${pct / 100})`;
      }
    };
    if (!isPlaying) {
      const pos = getPlaybackPositionMs();
      if (effectiveDuration > 0 && pos > 0) {
        update((pos / effectiveDuration) * 100, true);
      } else {
        update(0, false);
      }
      return;
    }
    let rafId: number;
    const tick = () => {
      if (effectiveDuration > 0) {
        const pos = getPlaybackPositionMs();
        update((pos / effectiveDuration) * 100, true);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, effectiveDuration, getPlaybackPositionMs]);

  const [seekDragging, setSeekDragging] = useState(false);

  const handleSeekFromHeader = useCallback((e: React.MouseEvent) => {
    if (!onSeek) return;
    const headerEl = e.currentTarget;
    const rect = headerEl.getBoundingClientRect();
    // Offset by label width
    const x = e.clientX - rect.left - LABEL_WIDTH;
    const w = rect.width - LABEL_WIDTH;
    if (x < 0 || w <= 0) return;
    const ms = (x / w) * effectiveDuration;
    onSeek(Math.max(0, Math.min(ms, effectiveDuration)));
  }, [onSeek, effectiveDuration]);

  const handleSeekMouseDown = useCallback((e: React.MouseEvent) => {
    handleSeekFromHeader(e);
    setSeekDragging(true);
  }, [handleSeekFromHeader]);

  const handleSeekMouseMove = useCallback((e: React.MouseEvent) => {
    if (!seekDragging) return;
    handleSeekFromHeader(e);
  }, [seekDragging, handleSeekFromHeader]);

  const handleSeekMouseUp = useCallback(() => {
    setSeekDragging(false);
  }, []);

  const emitChange = useCallback((newBars: NoteBar[]) => {
    setBars(newBars);
    onSequenceChange?.(barsToSequence(newBars));
  }, [onSequenceChange]);

  const getGridWidth = useCallback(() => gridRef.current ? gridRef.current.clientWidth : 700, []);
  const msToPercent = useCallback((ms: number) => (ms / effectiveDuration) * 100, [effectiveDuration]);
  const noteToRow = useCallback((note: number) => MAX_NOTE - note, []);

  const getGridPos = useCallback((e: React.MouseEvent) => {
    const el = gridRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const xToMs = useCallback((x: number) => {
    const w = getGridWidth();
    return Math.max(0, (x / w) * effectiveDuration);
  }, [effectiveDuration, getGridWidth]);

  const yToNote = useCallback((y: number) => {
    const row = Math.floor(y / ROW_HEIGHT);
    return Math.max(MIN_NOTE, Math.min(MAX_NOTE, MAX_NOTE - row));
  }, []);

  const hitTestBar = useCallback((x: number, y: number): { bar: NoteBar; resize: boolean } | null => {
    const w = getGridWidth();
    for (let i = barsRef.current.length - 1; i >= 0; i--) {
      const b = barsRef.current[i];
      const bx = (b.startMs / effectiveDuration) * w;
      const bw = Math.max(6, (b.durationMs / effectiveDuration) * w);
      const by = (MAX_NOTE - b.noteNumber) * ROW_HEIGHT;
      if (x >= bx && x <= bx + bw && y >= by && y <= by + ROW_HEIGHT) {
        return { bar: b, resize: x >= bx + bw - 8 };
      }
    }
    return null;
  }, [effectiveDuration, getGridWidth]);

  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getGridPos(e);
    const hit = hitTestBar(pos.x, pos.y);
    if (hit) {
      if (e.shiftKey) {
        setSelectedIds(prev => {
          const s = new Set(prev);
          s.has(hit.bar.id) ? s.delete(hit.bar.id) : s.add(hit.bar.id);
          return s;
        });
      } else if (!selectedIds.has(hit.bar.id)) {
        setSelectedIds(new Set([hit.bar.id]));
      }
      setDragState({
        type: hit.resize ? 'resize' : 'move',
        barId: hit.bar.id, startX: pos.x, startY: pos.y,
        origStartMs: hit.bar.startMs, origNote: hit.bar.noteNumber, origDurMs: hit.bar.durationMs,
      });
    } else if (!e.shiftKey) {
      setSelectedIds(new Set());
    }
  }, [getGridPos, hitTestBar, selectedIds]);

  const handleGridDoubleClick = useCallback((e: React.MouseEvent) => {
    const pos = getGridPos(e);
    if (hitTestBar(pos.x, pos.y)) return;
    const note = yToNote(pos.y);
    const startMs = xToMs(pos.x);
    const beatMs = 60_000 / bpm;
    const newBar: NoteBar = { id: genId(), noteNumber: note, startMs, durationMs: beatMs / 2, velocity: DEFAULT_VELOCITY };
    setSelectedIds(new Set([newBar.id]));
    emitChange([...barsRef.current, newBar]);
  }, [getGridPos, hitTestBar, yToNote, xToMs, bpm, emitChange, genId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return;
    const pos = getGridPos(e);
    const w = getGridWidth();
    const dx = pos.x - dragState.startX;
    const dy = pos.y - dragState.startY;
    const deltaMs = (dx / w) * effectiveDuration;
    const deltaNote = -Math.round(dy / ROW_HEIGHT);
    const newBars = barsRef.current.map(b => {
      const isTarget = b.id === dragState.barId || selectedIds.has(b.id);
      if (!isTarget) return b;
      if (dragState.type === 'resize') {
        return { ...b, durationMs: Math.max(MIN_NOTE_MS, dragState.origDurMs + deltaMs) };
      }
      return {
        ...b,
        startMs: Math.max(0, dragState.origStartMs + deltaMs),
        noteNumber: Math.max(MIN_NOTE, Math.min(MAX_NOTE, dragState.origNote + deltaNote)),
      };
    });
    setBars(newBars);
  }, [dragState, getGridPos, getGridWidth, effectiveDuration, selectedIds]);

  const handleMouseUp = useCallback(() => {
    if (dragState) { emitChange(barsRef.current); setDragState(null); }
  }, [dragState, emitChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
      e.preventDefault();
      emitChange(barsRef.current.filter(b => !selectedIds.has(b.id)));
      setSelectedIds(new Set());
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && selectedIds.size > 0) {
      e.preventDefault();
      setClipboard(barsRef.current.filter(b => selectedIds.has(b.id)));
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboard.length > 0) {
      e.preventDefault();
      const minStart = Math.min(...clipboard.map(b => b.startMs));
      const pasteAt = barsRef.current.length > 0
        ? Math.max(...barsRef.current.map(b => b.startMs + b.durationMs)) + 100 : 0;
      const pasted = clipboard.map(b => ({ ...b, id: genId(), startMs: b.startMs - minStart + pasteAt }));
      setSelectedIds(new Set(pasted.map(b => b.id)));
      emitChange([...barsRef.current, ...pasted]);
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      setSelectedIds(new Set(barsRef.current.map(b => b.id)));
    }
  }, [selectedIds, clipboard, emitChange, genId]);

  const beatMarkers = useMemo(() => computeBeatMarkers(bpm, effectiveDuration), [bpm, effectiveDuration]);
  const rows = useMemo(() => {
    const r: { note: number; label: string; isBlack: boolean }[] = [];
    for (let i = 0; i < NOTE_RANGE; i++) {
      const note = MAX_NOTE - i;
      r.push({ note, label: midiNoteToLabel(note), isBlack: BLACK_KEYS.has(note % 12) });
    }
    return r;
  }, []);

  const gridH = NOTE_RANGE * ROW_HEIGHT;
  const bg = theme.isDark ? '#16162a' : '#FFF9F5';
  const labelBg = theme.isDark ? '#1e1e34' : '#FFF0E8';
  const rowBorder = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const blackRowBg = theme.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const beatLineColor = theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const labelColor = theme.isDark ? '#8878a0' : '#A89AAF';
  const cursorColor = theme.isDark ? '#FF9A8B' : '#FF7A6B';

  return (
    <div tabIndex={0} onKeyDown={handleKeyDown}
      style={{ flex: 1, overflow: 'auto', borderRadius: 12,
        border: `1px solid ${theme.border}`, background: bg, outline: 'none',
        display: 'flex', flexDirection: 'column', userSelect: 'none' }}>

      <div
        onMouseDown={handleSeekMouseDown}
        onMouseMove={handleSeekMouseMove}
        onMouseUp={handleSeekMouseUp}
        onMouseLeave={handleSeekMouseUp}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <BeatHeader markers={beatMarkers} msToPercent={msToPercent}
          labelColor={labelColor} beatLineColor={beatLineColor} rowBorder={rowBorder} labelBg={labelBg} />
        {/* Playhead triangle in header — positioned over the content area (after label column) */}
        <div ref={headCursorRef} style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 2,
          background: cursorColor,
          display: 'none',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', bottom: -4, left: -6,
            width: 0, height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderBottom: `8px solid ${cursorColor}`,
            filter: `drop-shadow(0 0 4px ${cursorColor})`,
          }} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
        <NoteLabels rows={rows} rowBorder={rowBorder} labelColor={labelColor} labelBg={labelBg} />

        <div ref={gridRef}
          onMouseDown={handleGridMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onDoubleClick={handleGridDoubleClick}
          style={{ flex: 1, position: 'relative', cursor: 'crosshair', minHeight: gridH }}>

          <GridRows rows={rows} rowBorder={rowBorder} blackRowBg={blackRowBg} />
          <BeatLines markers={beatMarkers} msToPercent={msToPercent} color={beatLineColor} />

          {/* Note bars */}
          {bars.map(bar => {
            const isSelected = selectedIds.has(bar.id);
            const row = noteToRow(bar.noteNumber);
            const barColor = isSelected
              ? (theme.isDark ? '#F5C77E' : '#F5B85E')
              : (theme.isDark ? '#C4A8E0' : '#D4B8F0');
            return (
              <div key={bar.id} style={{
                position: 'absolute',
                left: `${msToPercent(bar.startMs)}%`,
                width: `${Math.max(0.5, msToPercent(bar.durationMs))}%`,
                top: row * ROW_HEIGHT + 1,
                height: ROW_HEIGHT - 2,
                background: barColor,
                borderRadius: 4,
                boxSizing: 'border-box',
                border: isSelected ? `1.5px solid ${theme.isDark ? '#fff' : '#5a3e1b'}` : 'none',
                boxShadow: isSelected ? `0 0 6px ${barColor}88` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: 4, height: '60%', borderRadius: 2, marginRight: 2,
                  background: theme.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.2)',
                }} />
              </div>
            );
          })}

          {/* Playback cursor line in grid — updated via ref, not state */}
          <div ref={cursorRef} style={{
            position: 'absolute', top: 0, bottom: 0, width: 2,
            background: cursorColor, pointerEvents: 'none',
            boxShadow: `0 0 8px ${cursorColor}`,
            display: 'none',
            zIndex: 10,
          }} />
        </div>
      </div>
    </div>
  );
};
