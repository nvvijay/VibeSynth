import React, { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../../theme';
import type { TransportState, NoteEventRecord, ArpPattern } from '../../types';
import type { SequencerEngine } from '../../engine/sequencer/SequencerEngine';
import type { LatchEngine } from '../../engine/sequencer/LatchEngine';
import type { ArpeggiatorEngine } from '../../engine/sequencer/ArpeggiatorEngine';
import type { QuantizeDivision } from '../../engine/sequencer/sequencer-utils';
import { TransportControls } from './TransportControls';
import { PianoRoll } from './PianoRoll';

interface SequencerViewProps {
  sequencer: SequencerEngine;
  latch: LatchEngine;
  arpeggiator: ArpeggiatorEngine;
  theme: Theme;
}

const ARP_PATTERNS: ArpPattern[] = ['up', 'down', 'up-down', 'random'];
const STEP_RESOLUTIONS = [
  { label: '1/4', value: 4 },
  { label: '1/8', value: 8 },
  { label: '1/16', value: 16 },
];

const QUANTIZE_DIVISIONS: { label: string; value: QuantizeDivision }[] = [
  { label: '1/4', value: 4 },
  { label: '1/8', value: 8 },
  { label: '1/16', value: 16 },
  { label: '1/32', value: 32 },
];

export const SequencerView: React.FC<SequencerViewProps> = ({
  sequencer, latch, arpeggiator, theme,
}) => {
  const [transportState, setTransportState] = useState<TransportState>('stopped');
  const [sequence, setSequence] = useState<NoteEventRecord[]>([]);
  const [durationMs, setDurationMs] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [latchEnabled, setLatchEnabled] = useState(false);
  const [arpEnabled, setArpEnabled] = useState(false);
  const [arpPattern, setArpPattern] = useState<ArpPattern>('up');
  const [stepRes, setStepRes] = useState(8);
  const [quantizeDiv, setQuantizeDiv] = useState<QuantizeDivision>(8);

  // Poll sequencer state — only update React state for transport changes, not position
  useEffect(() => {
    const id = setInterval(() => {
      const s = sequencer.getState();
      if (s !== transportState) {
        setTransportState(s);
        setSequence(sequencer.getSequence());
        setDurationMs(sequencer.getSequenceDurationMs());
      }
    }, 100);
    return () => clearInterval(id);
  }, [sequencer, transportState]);

  const handleRecord = useCallback(() => sequencer.record(), [sequencer]);
  const handlePlay = useCallback(() => sequencer.play(), [sequencer]);
  const handleStop = useCallback(() => {
    sequencer.stop();
    setSequence(sequencer.getSequence());
    setDurationMs(sequencer.getSequenceDurationMs());
  }, [sequencer]);
  const handleClear = useCallback(() => {
    sequencer.clear();
    setSequence([]);
    setDurationMs(0);
  }, [sequencer]);

  const handleBpmChange = useCallback((val: number) => {
    setBpm(val);
    sequencer.setBpm(val);
    arpeggiator.setBpm(val);
  }, [sequencer, arpeggiator]);

  const handleLatchToggle = useCallback(() => {
    const next = !latchEnabled;
    setLatchEnabled(next);
    latch.setEnabled(next);
  }, [latch, latchEnabled]);

  const handleArpToggle = useCallback(() => {
    const next = !arpEnabled;
    setArpEnabled(next);
    arpeggiator.setEnabled(next);
    if (!next) arpeggiator.stop();
  }, [arpeggiator, arpEnabled]);

  const handleArpPattern = useCallback((p: ArpPattern) => {
    setArpPattern(p);
    arpeggiator.setPattern(p);
  }, [arpeggiator]);

  const handleStepRes = useCallback((v: number) => {
    setStepRes(v);
    arpeggiator.setStepResolution(v);
  }, [arpeggiator]);

  const handleQuantize = useCallback(() => {
    sequencer.quantize(quantizeDiv);
    setSequence(sequencer.getSequence());
    setDurationMs(sequencer.getSequenceDurationMs());
  }, [sequencer, quantizeDiv]);

  const handleSequenceChange = useCallback((newSeq: NoteEventRecord[]) => {
    sequencer.setSequence(newSeq);
    setSequence(sequencer.getSequence());
    setDurationMs(sequencer.getSequenceDurationMs());
  }, [sequencer]);

  const handleSeek = useCallback((positionMs: number) => {
    sequencer.seek(positionMs);
  }, [sequencer]);

  const getPlaybackPosition = useCallback(() => sequencer.getPlaybackPositionMs(), [sequencer]);

  const cardBg = theme.isDark ? '#22223a' : '#FFF8F0';
  const sectionStyle: React.CSSProperties = {
    background: cardBg,
    borderRadius: 12,
    padding: 12,
    border: `1px solid ${theme.border}`,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 4,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  };
  const toggleBtn = (active: boolean, color: string): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    background: active ? color : (theme.isDark ? '#2a2a44' : '#F0E6DD'),
    color: active ? '#fff' : theme.text,
    boxShadow: active ? `0 0 10px ${color}66` : 'none',
    transition: 'all 0.15s ease',
  });
  const selectStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: 6,
    border: `1px solid ${theme.inputBorder}`,
    background: theme.inputBg,
    color: theme.text,
    fontSize: 12,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', padding: 12 }}>
      {/* Top controls row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {/* Transport */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Transport</div>
          <TransportControls
            state={transportState}
            hasSequence={sequence.length > 0}
            onRecord={handleRecord}
            onPlay={handlePlay}
            onStop={handleStop}
            onClear={handleClear}
            theme={theme}
          />
        </div>

        {/* BPM */}
        <div style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={labelStyle}>BPM</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={20}
              max={300}
              value={bpm}
              onChange={e => handleBpmChange(Number(e.target.value))}
              style={{ width: 100 }}
            />
            <span style={{ fontSize: 16, fontWeight: 700, color: theme.text, minWidth: 36 }}>{bpm}</span>
          </div>
        </div>

        {/* Latch */}
        <div style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={labelStyle}>Latch</div>
          <button onClick={handleLatchToggle} style={toggleBtn(latchEnabled, '#C4A8E0')}>
            {latchEnabled ? '🔒 On' : '🔓 Off'}
          </button>
        </div>

        {/* Arpeggiator */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Arpeggiator</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleArpToggle} style={toggleBtn(arpEnabled, '#8DD4B8')}>
              {arpEnabled ? '▶ On' : '○ Off'}
            </button>
            <select
              value={arpPattern}
              onChange={e => handleArpPattern(e.target.value as ArpPattern)}
              style={selectStyle}
              disabled={!arpEnabled}
            >
              {ARP_PATTERNS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={stepRes}
              onChange={e => handleStepRes(Number(e.target.value))}
              style={selectStyle}
              disabled={!arpEnabled}
            >
              {STEP_RESOLUTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quantize */}
        <div style={sectionStyle}>
          <div style={labelStyle}>Quantize</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={quantizeDiv}
              onChange={e => setQuantizeDiv(Number(e.target.value) as QuantizeDivision)}
              style={selectStyle}
            >
              {QUANTIZE_DIVISIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <button
              onClick={handleQuantize}
              disabled={sequence.length === 0 || transportState !== 'stopped'}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                cursor: sequence.length > 0 && transportState === 'stopped' ? 'pointer' : 'not-allowed',
                fontSize: 13,
                fontWeight: 600,
                background: sequence.length > 0 && transportState === 'stopped'
                  ? '#F5C77E'
                  : (theme.isDark ? '#2a2a44' : '#F0E6DD'),
                color: sequence.length > 0 && transportState === 'stopped' ? '#5a3e1b' : theme.textMuted,
                opacity: sequence.length === 0 || transportState !== 'stopped' ? 0.5 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              🎯 Snap
            </button>
          </div>
        </div>
      </div>

      {/* Piano Roll */}
      <PianoRoll
        sequence={sequence}
        durationMs={durationMs}
        getPlaybackPositionMs={getPlaybackPosition}
        isPlaying={transportState === 'playing'}
        bpm={bpm}
        theme={theme}
        onSequenceChange={handleSequenceChange}
        onSeek={handleSeek}
      />
    </div>
  );
};
