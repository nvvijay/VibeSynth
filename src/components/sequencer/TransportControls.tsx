import React from 'react';
import type { TransportState } from '../../types';
import type { Theme } from '../../theme';

interface TransportControlsProps {
  state: TransportState;
  hasSequence: boolean;
  onRecord: () => void;
  onPlay: () => void;
  onStop: () => void;
  onClear: () => void;
  theme: Theme;
}

const btnBase: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: 'none',
  fontSize: 20,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
};

export const TransportControls: React.FC<TransportControlsProps> = ({
  state, hasSequence, onRecord, onPlay, onStop, onClear, theme,
}) => {
  const bg = theme.isDark ? '#2a2a44' : '#FFF0E8';
  const disabledBg = theme.isDark ? '#1e1e34' : '#F0E6DD';
  const textColor = theme.isDark ? '#c4b8d4' : '#6B5B7B';
  const disabledText = theme.isDark ? '#555' : '#C0B0B0';

  const recordActive = state === 'recording';
  const playActive = state === 'playing';

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button
        onClick={onRecord}
        style={{
          ...btnBase,
          background: recordActive ? '#FF9A8B' : bg,
          color: recordActive ? '#fff' : textColor,
          boxShadow: recordActive ? '0 0 12px rgba(255,154,139,0.5)' : 'none',
        }}
        title="Record"
        aria-label="Record"
      >⏺</button>
      <button
        onClick={onPlay}
        disabled={!hasSequence && state !== 'playing'}
        style={{
          ...btnBase,
          background: playActive ? '#8DD4B8' : (!hasSequence ? disabledBg : bg),
          color: playActive ? '#fff' : (!hasSequence ? disabledText : textColor),
          boxShadow: playActive ? '0 0 12px rgba(141,212,184,0.5)' : 'none',
          cursor: !hasSequence && state !== 'playing' ? 'not-allowed' : 'pointer',
        }}
        title="Play"
        aria-label="Play"
      >▶</button>
      <button
        onClick={onStop}
        style={{ ...btnBase, background: bg, color: textColor }}
        title="Stop"
        aria-label="Stop"
      >⏹</button>
      <button
        onClick={onClear}
        disabled={!hasSequence}
        style={{
          ...btnBase,
          background: !hasSequence ? disabledBg : bg,
          color: !hasSequence ? disabledText : textColor,
          cursor: !hasSequence ? 'not-allowed' : 'pointer',
        }}
        title="Clear"
        aria-label="Clear"
      >🗑</button>
    </div>
  );
};
