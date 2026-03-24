import { useState, useRef } from 'react';
import type { AudioGraph } from '../../engine/audio/AudioGraph';
import type { ModuleRegistry } from '../../engine/audio/ModuleRegistry';
import { PatchSerializer } from '../../engine/serialization/PatchSerializer';
import { Visualizer } from '../common/Visualizer';
import type { Theme } from '../../theme';

export type ViewMode = 'editor' | 'visualizer' | 'sequencer';

export interface ToolbarProps {
  masterVolume: number;
  onMasterVolumeChange: (vol: number) => void;
  graph: AudioGraph;
  registry: ModuleRegistry;
  analyserNode: AnalyserNode | null;
  onPatchLoaded: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  theme: Theme;
  isDark: boolean;
  onToggleDark: () => void;
}

export function Toolbar({
  masterVolume, onMasterVolumeChange,
  graph, registry, analyserNode, onPatchLoaded,
  viewMode, onViewModeChange, theme, isDark, onToggleDark,
}: ToolbarProps) {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const serializer = useRef(new PatchSerializer(registry));

  const handleSave = () => {
    try {
      const json = serializer.current.serialize(graph, {
        masterVolume,
        polyphony: graph.getPolyphony(),
      });
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibesynth-patch-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const patch = serializer.current.deserialize(text);
      // Clear existing graph
      for (const mod of graph.getModules()) {
        graph.removeModule(mod.id);
      }
      // Restore modules (map old IDs to new IDs)
      const idMap = new Map<string, string>();
      for (const mod of patch.modules) {
        const inst = graph.addModule(mod.typeId, mod.position);
        idMap.set(mod.id, inst.id);
        for (const [key, val] of Object.entries(mod.parameters)) {
          graph.setParameter(inst.id, key, val as string | number);
        }
      }
      // Restore connections using remapped IDs
      for (const conn of patch.connections) {
        const srcId = idMap.get(conn.sourceModuleId);
        const tgtId = idMap.get(conn.targetModuleId);
        if (srcId && tgtId) {
          graph.connect(srcId, conn.sourcePortId, tgtId, conn.targetPortId);
        }
      }
      onMasterVolumeChange(patch.masterVolume);
      graph.setPolyphony(patch.polyphony);
      onPatchLoaded();
      setError(null);
    } catch (err) {
      setError(`Load failed: ${err instanceof Error ? err.message : 'Invalid patch file'}`);
    }
    e.target.value = '';
  };

  const btnStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 8,
    border: `1px solid ${theme.inputBorder}`,
    background: theme.cardBg,
    fontSize: 12,
    fontWeight: 600,
    color: theme.textHeading,
    cursor: 'pointer',
    transition: 'background 0.12s',
  };

  const toggleBtnStyle = (active: boolean): React.CSSProperties => ({
    ...btnStyle,
    background: active ? (isDark ? '#2e2450' : '#E8DFF5') : theme.cardBg,
    border: active ? `1px solid ${theme.accent}` : `1px solid ${theme.inputBorder}`,
    color: active ? theme.textHeading : theme.text,
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '8px 20px',
      borderBottom: `1px solid ${theme.border}`,
      background: theme.bg,
      flexShrink: 0,
      flexWrap: 'wrap',
    }}>
      {/* Master Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: theme.textHeading }}>Master</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
          style={{ width: 100, accentColor: theme.accent }}
          aria-label="Master volume"
        />
        <span style={{ fontSize: 11, color: theme.textMuted, minWidth: 32 }}>
          {Math.round(masterVolume * 100)}%
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: theme.border }} />

      {/* Save / Load */}
      <button onClick={handleSave} style={btnStyle}>💾 Save Patch</button>
      <button onClick={handleLoad} style={btnStyle}>📂 Load Patch</button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: theme.border }} />

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          onClick={() => onViewModeChange('editor')}
          style={toggleBtnStyle(viewMode === 'editor')}
        >
          🔌 Editor
        </button>
        <button
          onClick={() => onViewModeChange('visualizer')}
          style={toggleBtnStyle(viewMode === 'visualizer')}
        >
          📊 Analyzer
        </button>
        <button
          onClick={() => onViewModeChange('sequencer')}
          style={toggleBtnStyle(viewMode === 'sequencer')}
        >
          🎹 Sequencer
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: theme.border }} />

      {/* Dark mode toggle */}
      <button
        onClick={onToggleDark}
        style={{
          ...btnStyle,
          padding: '6px 10px',
          fontSize: 16,
          lineHeight: 1,
        }}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: theme.border }} />

      {/* Mini visualizer */}
      <Visualizer analyserNode={analyserNode} width={120} height={40} theme={theme} />

      {/* Error message */}
      {error && (
        <div style={{
          fontSize: 11,
          color: isDark ? '#FFB5A7' : '#B5736A',
          background: isDark ? '#2a1f1f' : '#FFE5DE',
          padding: '4px 10px',
          borderRadius: 6,
          maxWidth: 300,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default Toolbar;
