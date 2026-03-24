import { useState, useRef, useCallback, useEffect } from 'react';
import type { ModuleInstance, ConnectionDescriptor, ViewportState } from '../../types';
import type { AudioGraph } from '../../engine/audio/AudioGraph';
import type { ModuleRegistry } from '../../engine/audio/ModuleRegistry';
import type { Theme } from '../../theme';
import { GraphNode, NODE_WIDTH, PORT_TYPE_COLORS, getPortCenterY } from './GraphNode';

interface DragState {
  moduleId: string;
  offsetX: number;
  offsetY: number;
}

interface SnapTarget {
  moduleId: string;
  portId: string;
  x: number;
  y: number;
}

interface PendingConnection {
  sourceModuleId: string;
  sourcePortId: string;
  portType: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  snap: SnapTarget | null;
}

const SNAP_RADIUS = 30;

/** Border width used by GraphNode (must match the node's border style). */
const NODE_BORDER = 1.5;

function getPortPosition(
  mod: ModuleInstance,
  portId: string,
  direction: 'input' | 'output',
): { x: number; y: number } {
  const ports = mod.ports.filter((p) => p.direction === direction);
  const idx = ports.findIndex((p) => p.id === portId);
  // Port circles sit at the edge of the content area (inside the border).
  // With border-box, content starts at position + border.
  const x = direction === 'output'
    ? mod.position.x + NODE_WIDTH - NODE_BORDER
    : mod.position.x + NODE_BORDER;
  const y = mod.position.y + NODE_BORDER + getPortCenterY(idx);
  return { x, y };
}

function getConnectionPortType(
  modules: ModuleInstance[],
  conn: ConnectionDescriptor,
): string {
  const srcMod = modules.find((m) => m.id === conn.sourceModuleId);
  if (!srcMod) return 'audio';
  const port = srcMod.ports.find((p) => p.id === conn.sourcePortId);
  return port?.type ?? 'audio';
}

export interface GraphEditorProps {
  graph: AudioGraph;
  registry: ModuleRegistry;
  theme: Theme;
  refreshKey?: number;
}

export function GraphEditor({ graph, registry, theme, refreshKey }: GraphEditorProps) {
  const [modules, setModules] = useState<ModuleInstance[]>([]);
  const [connections, setConnections] = useState<ConnectionDescriptor[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const syncState = useCallback(() => {
    setModules([...graph.getModules()]);
    setConnections([...graph.getConnections()]);
  }, [graph]);

  useEffect(() => { syncState(); }, [syncState]);

  useEffect(() => { syncState(); }, [refreshKey, syncState]);

  const handleParamChange = useCallback((moduleId: string, paramId: string, value: number | string) => {
    graph.setParameter(moduleId, paramId, value);
    syncState();
  }, [graph, syncState]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const typeId = e.dataTransfer.getData('application/synth-module');
    if (!typeId) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - viewport.panX) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.panY) / viewport.zoom;
    try {
      graph.addModule(typeId, { x, y });
      syncState();
    } catch (err) {
      console.error('Failed to add module:', err);
    }
  }, [graph, viewport, syncState]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleSelectNode = useCallback((id: string) => {
    setSelectedNodeId(id);
    setSelectedConnId(null);
  }, []);

  const handleNodeDragStart = useCallback((id: string, offsetX: number, offsetY: number) => {
    setDragState({ moduleId: id, offsetX, offsetY });
  }, []);

  const findSnapTarget = useCallback((
    mouseX: number, mouseY: number, sourceModuleId: string, portType: string,
  ): SnapTarget | null => {
    let best: SnapTarget | null = null;
    let bestDist = SNAP_RADIUS;
    for (const mod of graph.getModules()) {
      if (mod.id === sourceModuleId) continue;
      const inputPorts = mod.ports.filter((p) => p.direction === 'input' && p.type === portType);
      inputPorts.forEach((port) => {
        const pos = getPortPosition(mod, port.id, 'input');
        const dx = mouseX - pos.x;
        const dy = mouseY - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { moduleId: mod.id, portId: port.id, x: pos.x, y: pos.y };
        }
      });
    }
    return best;
  }, [graph]);

  const handlePortMouseDown = useCallback((
    moduleId: string, portId: string, direction: 'input' | 'output', portType: string, e: React.MouseEvent,
  ) => {
    const mod = graph.getModules().find((m) => m.id === moduleId);
    if (!mod) return;
    const pos = getPortPosition(mod, portId, direction);
    if (direction === 'output') {
      setPendingConn({
        sourceModuleId: moduleId, sourcePortId: portId, portType,
        startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y,
        snap: null,
      });
    }
    e.stopPropagation();
  }, [graph]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = (e.clientX - rect.left - viewport.panX) / viewport.zoom - dragState.offsetX;
        const y = (e.clientY - rect.top - viewport.panY) / viewport.zoom - dragState.offsetY;
        const mod = graph.getModules().find((m) => m.id === dragState.moduleId);
        if (mod) { mod.position.x = x; mod.position.y = y; syncState(); }
      }
      if (pendingConn) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mx = (e.clientX - rect.left - viewport.panX) / viewport.zoom;
        const my = (e.clientY - rect.top - viewport.panY) / viewport.zoom;
        const snap = findSnapTarget(mx, my, pendingConn.sourceModuleId, pendingConn.portType);
        setPendingConn((prev) => prev ? {
          ...prev,
          currentX: snap ? snap.x : mx,
          currentY: snap ? snap.y : my,
          snap,
        } : null);
      }
      if (isPanning) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setViewport((v) => ({ ...v, panX: panStart.current.panX + dx, panY: panStart.current.panY + dy }));
      }
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (pendingConn) {
        // Use snap target if available, otherwise fall back to elementFromPoint
        if (pendingConn.snap) {
          try {
            graph.connect(pendingConn.sourceModuleId, pendingConn.sourcePortId, pendingConn.snap.moduleId, pendingConn.snap.portId);
            syncState();
          } catch (err) { console.warn('Connection failed:', err); }
        } else {
          const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          const portEl = target?.closest('[data-port-id]') as HTMLElement | null;
          if (portEl) {
            const tModId = portEl.getAttribute('data-module-id');
            const tPortId = portEl.getAttribute('data-port-id');
            const tDir = portEl.getAttribute('data-direction');
            if (tModId && tPortId && tDir === 'input') {
              try { graph.connect(pendingConn.sourceModuleId, pendingConn.sourcePortId, tModId, tPortId); syncState(); }
              catch (err) { console.warn('Connection failed:', err); }
            }
          }
        }
        setPendingConn(null);
      }
      setDragState(null);
      setIsPanning(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [dragState, pendingConn, isPanning, viewport, graph, syncState]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvas) {
      setSelectedNodeId(null);
      setSelectedConnId(null);
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.97 : 1.03;
    setViewport((v) => ({ ...v, zoom: Math.min(4, Math.max(0.25, v.zoom * delta)) }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;
        if (selectedNodeId) { graph.removeModule(selectedNodeId); setSelectedNodeId(null); syncState(); }
        else if (selectedConnId) { graph.disconnect(selectedConnId); setSelectedConnId(null); syncState(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedConnId, graph, syncState]);

  const renderConnections = () => {
    const allConns = connections.map((conn) => {
      const srcMod = modules.find((m) => m.id === conn.sourceModuleId);
      const tgtMod = modules.find((m) => m.id === conn.targetModuleId);
      if (!srcMod || !tgtMod) return null;
      const start = getPortPosition(srcMod, conn.sourcePortId, 'output');
      const end = getPortPosition(tgtMod, conn.targetPortId, 'input');
      const portType = getConnectionPortType(modules, conn);
      const colors = PORT_TYPE_COLORS[portType] ?? PORT_TYPE_COLORS.audio;
      const isSelected = selectedConnId === conn.id;
      const dx = Math.abs(end.x - start.x) * 0.5;
      return (
        <g key={conn.id} onClick={() => { setSelectedConnId(conn.id); setSelectedNodeId(null); }} style={{ cursor: 'pointer' }}>
          <path
            d={`M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`}
            fill="none"
            stroke={isSelected ? colors.stroke : colors.fill}
            strokeWidth={isSelected ? 3 : 2}
            opacity={isSelected ? 1 : 0.7}
          />
          {/* Wider invisible hit area */}
          <path
            d={`M ${start.x} ${start.y} C ${start.x + dx} ${start.y}, ${end.x - dx} ${end.y}, ${end.x} ${end.y}`}
            fill="none"
            stroke="transparent"
            strokeWidth={12}
          />
        </g>
      );
    });

    let pendingPath = null;
    if (pendingConn) {
      const dx = Math.abs(pendingConn.currentX - pendingConn.startX) * 0.5;
      const colors = PORT_TYPE_COLORS[pendingConn.portType] ?? PORT_TYPE_COLORS.audio;
      pendingPath = (
        <g>
          <path
            d={`M ${pendingConn.startX} ${pendingConn.startY} C ${pendingConn.startX + dx} ${pendingConn.startY}, ${pendingConn.currentX - dx} ${pendingConn.currentY}, ${pendingConn.currentX} ${pendingConn.currentY}`}
            fill="none"
            stroke={pendingConn.snap ? colors.fill : colors.stroke}
            strokeWidth={pendingConn.snap ? 2.5 : 2}
            strokeDasharray={pendingConn.snap ? 'none' : '6 3'}
            opacity={pendingConn.snap ? 0.9 : 0.6}
          />
          {pendingConn.snap && (
            <circle
              cx={pendingConn.snap.x}
              cy={pendingConn.snap.y}
              r={8}
              fill="none"
              stroke={colors.fill}
              strokeWidth={2}
              opacity={0.8}
            >
              <animate attributeName="r" values="8;11;8" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      );
    }

    return (
      <svg
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          pointerEvents: 'none', overflow: 'visible',
        }}
      >
        <g transform={`translate(${viewport.panX},${viewport.panY}) scale(${viewport.zoom})`} style={{ pointerEvents: 'auto' }}>
          {allConns}
          {pendingPath}
        </g>
      </svg>
    );
  };

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: theme.canvasBg }}>
      {/* Canvas */}
      <div
        ref={canvasRef}
        data-canvas="true"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        style={{
          width: '100%', height: '100%', position: 'relative',
          backgroundImage: `radial-gradient(circle, ${theme.canvasDot} 1px, transparent 1px)`,
          backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
          backgroundPosition: `${viewport.panX}px ${viewport.panY}px`,
          cursor: isPanning ? 'grabbing' : 'default',
        }}
      >
        {/* Nodes layer */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0,
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {modules.map((mod) => {
            const def = registry.get(mod.typeId);
            return (
              <GraphNode
                key={mod.id}
                instance={mod}
                category={def?.category ?? 'utility'}
                name={def?.name ?? mod.typeId}
                selected={selectedNodeId === mod.id}
                onSelect={handleSelectNode}
                onDragStart={handleNodeDragStart}
                onPortMouseDown={handlePortMouseDown}
                connections={connections}
                parameters={def?.parameters}
                onParamChange={handleParamChange}
                theme={theme}
              />
            );
          })}
        </div>

        {/* Connections layer */}
        {renderConnections()}

        {/* Empty state */}
        {modules.length === 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            textAlign: 'center', color: theme.textMuted, pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎵</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Drag modules here to start</div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Drop modules from the palette on the left</div>
          </div>
        )}
      </div>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        background: theme.isDark ? 'rgba(26,26,46,0.9)' : 'rgba(255,249,245,0.9)', borderRadius: 8,
        padding: '4px 10px', fontSize: 11, color: theme.textMuted,
        border: `1px solid ${theme.border}`,
      }}>
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
}

export default GraphEditor;
