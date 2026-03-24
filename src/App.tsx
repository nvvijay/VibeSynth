import { useState } from 'react';
import './App.css';
import { VirtualKeyboard } from './components/keyboard/VirtualKeyboard';
import { ModulePalette } from './components/graph/ModulePalette';
import { GraphEditor } from './components/graph/GraphEditor';
import { Toolbar } from './components/toolbar/Toolbar';
import type { ViewMode } from './components/toolbar/Toolbar';
import { SpectrumAnalyzer } from './components/analyzer/SpectrumAnalyzer';
import { SequencerView } from './components/sequencer/SequencerView';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useMIDI } from './hooks/useMIDI';
import { useNoteRouting } from './hooks/useNoteRouting';
import { lightTheme, darkTheme } from './theme';
import type { Theme } from './theme';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [isDark, setIsDark] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(true);
  const theme: Theme = isDark ? darkTheme : lightTheme;

  const {
    registryRef, graphRef, allModules, ready,
    masterVolume, setMasterVolume, analyserNode,
    refreshKey, audioStarted, ensureAudioContext, handlePatchLoaded,
  } = useAudioEngine();

  const {
    noteManagerRef, latchRef, arpRef, seqRef,
    handleNoteOn, handleNoteOff, handleDragStart,
  } = useNoteRouting({ graphRef, ensureAudioContext });

  const { midiStatus } = useMIDI({ noteManagerRef, graphRef });

  if (!ready || !registryRef.current || !graphRef.current) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: theme.bg, color: theme.textHeading, fontSize: 16,
      }}>
        Loading synthesizer…
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        background: theme.bg,
        color: theme.text,
        overflow: 'hidden',
      }}
      onClick={ensureAudioContext}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: `1px solid ${theme.border}`,
        background: theme.bg,
        flexShrink: 0,
      }}>
        <h1 style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #FFB5A7, #D4C4E8, #B5EAD7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
        }}>
          🎹 VibeSynth
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!audioStarted && (
            <span style={{
              fontSize: 10,
              color: isDark ? '#FFB5A7' : '#B5736A',
              background: isDark ? '#2a1f1f' : '#FFE5DE',
              padding: '3px 8px',
              borderRadius: 6,
              fontWeight: 600,
            }}>
              Click anywhere to enable audio
            </span>
          )}
          {midiStatus && (
            <span style={{
              fontSize: 10,
              color: '#8DD4B8',
              background: isDark ? '#1a2a22' : '#D4F5E9',
              padding: '3px 8px',
              borderRadius: 6,
              fontWeight: 600,
            }}>
              {midiStatus}
            </span>
          )}
          <span style={{ fontSize: 11, color: theme.textMuted }}>
            Modular Audio Synthesizer
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <Toolbar
        masterVolume={masterVolume}
        onMasterVolumeChange={setMasterVolume}
        graph={graphRef.current}
        registry={registryRef.current}
        analyserNode={analyserNode}
        onPatchLoaded={handlePatchLoaded}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        theme={theme}
        isDark={isDark}
        onToggleDark={() => setIsDark((v) => !v)}
      />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {viewMode === 'editor' ? (
          <>
            <ModulePalette modules={allModules} onDragStart={handleDragStart} theme={theme} />
            <GraphEditor graph={graphRef.current} registry={registryRef.current} theme={theme} refreshKey={refreshKey} />
          </>
        ) : viewMode === 'sequencer' ? (
          seqRef.current && latchRef.current && arpRef.current ? (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <SequencerView
                sequencer={seqRef.current}
                latch={latchRef.current}
                arpeggiator={arpRef.current}
                theme={theme}
              />
            </div>
          ) : null
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.bgTertiary,
            padding: 32,
            gap: 16,
          }}>
            <SpectrumAnalyzer
              analyserNode={analyserNode}
              graph={graphRef.current}
              registry={registryRef.current}
              width={900}
              height={450}
              theme={theme}
              visible={viewMode === 'visualizer'}
            />
          </div>
        )}
      </div>

      {/* Bottom: floating collapsible keyboard */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <button
          onClick={() => setKeyboardVisible(v => !v)}
          style={{
            pointerEvents: 'auto',
            background: theme.isDark ? '#2a2a44ee' : '#F0E6DDee',
            border: `1px solid ${theme.border}`,
            borderBottom: keyboardVisible ? 'none' : `1px solid ${theme.border}`,
            borderRadius: '8px 8px 0 0',
            padding: '5px 32px',
            cursor: 'pointer',
            fontSize: 12,
            color: theme.isDark ? '#D4C4E8' : '#8B6B8B',
            fontWeight: 700,
            letterSpacing: 0.5,
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease',
          }}
          title={keyboardVisible ? 'Hide keyboard' : 'Show keyboard'}
        >
          {keyboardVisible ? '⌨ ▾ Hide Keyboard' : '⌨ ▴ Show Keyboard'}
        </button>
        <div style={{
          pointerEvents: 'auto',
          transition: 'max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease',
          maxHeight: keyboardVisible ? 200 : 0,
          opacity: keyboardVisible ? 1 : 0,
          overflow: 'hidden',
          padding: keyboardVisible ? '8px 0 12px' : '0',
          background: theme.isDark ? '#22223aee' : '#FFF8F0ee',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px 12px 0 0',
          boxShadow: keyboardVisible ? '0 -4px 24px rgba(0,0,0,0.15)' : 'none',
        }}>
          <VirtualKeyboard onNoteOn={handleNoteOn} onNoteOff={handleNoteOff} theme={theme} />
        </div>
      </div>
    </div>
  );
}

export default App;
