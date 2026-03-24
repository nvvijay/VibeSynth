import { useState, memo } from 'react';
import type { ModuleInstance, ConnectionDescriptor, PortDefinition, ParameterDefinition } from '../../types';
import type { Theme } from '../../theme';
import { darkCategoryColors } from '../../theme';
import { OscViz, LfoViz, AdsrViz, ReverbViz, DistortionViz, ChorusViz, FilterViz, CompressorViz, PannerViz, EqViz } from './visualizations';

const CATEGORY_COLORS: Record<string, { bg: string; header: string; text: string; port: string }> = {
  source:    { bg: '#FFF0EB', header: '#FFB5A7', text: '#8B5A50', port: '#FF9A8B' },
  effect:    { bg: '#FFFBEA', header: '#F5E6A3', text: '#8A7A3A', port: '#F0D86E' },
  modulator: { bg: '#F5F0FA', header: '#D4C4E8', text: '#6A5A7A', port: '#C4A8E0' },
  utility:   { bg: '#EAFAF3', header: '#B5EAD7', text: '#4A7A62', port: '#8DD4B8' },
};

const PORT_TYPE_COLORS: Record<string, { fill: string; stroke: string }> = {
  audio:   { fill: '#FFB5A7', stroke: '#FF9A8B' },
  control: { fill: '#D4C4E8', stroke: '#C4A8E0' },
};

export interface GraphNodeProps {
  instance: ModuleInstance;
  category: string;
  name: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string, offsetX: number, offsetY: number) => void;
  onPortMouseDown: (moduleId: string, portId: string, direction: 'input' | 'output', portType: string, e: React.MouseEvent) => void;
  connections: ConnectionDescriptor[];
  parameters?: ParameterDefinition[];
  onParamChange?: (moduleId: string, paramId: string, value: number | string) => void;
  theme: Theme;
  visible?: boolean;
}

const NODE_WIDTH = 180;
const PORT_SIZE = 12;
const HEADER_HEIGHT = 32;
const PORT_ROW_HEIGHT = 24;
const BODY_PADDING_TOP = 8;
const BODY_PADDING_BOTTOM = 8;

/** Returns the center Y of a port relative to the node's top-left corner. */
export function getPortCenterY(index: number): number {
  return HEADER_HEIGHT + BODY_PADDING_TOP + index * PORT_ROW_HEIGHT + PORT_ROW_HEIGHT / 2;
}

export const GraphNode = memo(function GraphNode({
  instance, category, name, selected, onSelect,
  onDragStart, onPortMouseDown, connections, parameters, onParamChange, theme, visible = true,
}: GraphNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const lightC = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.utility;
  const darkC = darkCategoryColors[category] ?? darkCategoryColors.utility;
  const c = theme.isDark ? darkC : lightC;
  const inputs = instance.ports.filter((p) => p.direction === 'input');
  const outputs = instance.ports.filter((p) => p.direction === 'output');
  const portRows = Math.max(inputs.length, outputs.length, 1);
  const bodyHeight = BODY_PADDING_TOP + portRows * PORT_ROW_HEIGHT + BODY_PADDING_BOTTOM;
  const hasParams = (parameters?.length ?? 0) > 0;

  const isPortConnected = (portId: string, direction: 'input' | 'output') => {
    return connections.some((conn) =>
      direction === 'output'
        ? conn.sourceModuleId === instance.id && conn.sourcePortId === portId
        : conn.targetModuleId === instance.id && conn.targetPortId === portId
    );
  };

  const renderPort = (port: PortDefinition, index: number, side: 'left' | 'right') => {
    const connected = isPortConnected(port.id, port.direction);
    const ptColors = PORT_TYPE_COLORS[port.type] ?? PORT_TYPE_COLORS.audio;
    const centerY = getPortCenterY(index) - HEADER_HEIGHT;
    return (
      <div
        key={port.id}
        style={{
          position: 'absolute',
          top: centerY - PORT_ROW_HEIGHT / 2,
          left: 0,
          right: 0,
          height: PORT_ROW_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: side === 'left' ? 'flex-start' : 'flex-end',
          paddingLeft: side === 'left' ? 14 : 0,
          paddingRight: side === 'right' ? 14 : 0,
        }}
      >
        <div
          data-port-id={port.id}
          data-module-id={instance.id}
          data-direction={port.direction}
          data-port-type={port.type}
          onMouseDown={(e) => {
            e.stopPropagation();
            onPortMouseDown(instance.id, port.id, port.direction, port.type, e);
          }}
          style={{
            position: 'absolute',
            [side]: -PORT_SIZE / 2,
            top: (PORT_ROW_HEIGHT - PORT_SIZE) / 2,
            width: PORT_SIZE,
            height: PORT_SIZE,
            borderRadius: '50%',
            background: connected ? ptColors.fill : (theme.isDark ? '#1a1a2e' : '#fff'),
            border: `2px solid ${ptColors.stroke}`,
            cursor: 'crosshair',
            zIndex: 5,
            transition: 'transform 0.1s',
          }}
          title={`${port.name} (${port.type})`}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.3)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
        />
        <span style={{
          fontSize: 10,
          color: c.text,
          opacity: 0.8,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flexDirection: side === 'right' ? 'row-reverse' : 'row',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: PORT_TYPE_COLORS[port.type]?.fill ?? '#ccc',
            display: 'inline-block', flexShrink: 0,
          }} />
          {port.name}
        </span>
      </div>
    );
  };

  const renderInlineParam = (param: ParameterDefinition) => {
    const val = instance.parameters[param.id] ?? param.defaultValue;
    return (
      <div key={param.id} style={{
        display: 'flex', alignItems: 'center', gap: 4, minHeight: 22,
      }}>
        <span style={{
          fontSize: 9, color: c.text, opacity: 0.7,
          width: 48, flexShrink: 0, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {param.name}
        </span>
        {param.type === 'enum' && param.enumValues ? (
          <select
            value={String(val)}
            onChange={(e) => {
              e.stopPropagation();
              onParamChange?.(instance.id, param.id, e.target.value);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              flex: 1, minWidth: 0,
              padding: '1px 2px', borderRadius: 4,
              border: `1px solid ${c.header}`, background: theme.isDark ? '#1a1a2e' : '#fff',
              fontSize: 10, color: c.text, outline: 'none', cursor: 'pointer',
            }}
          >
            {param.enumValues.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : (
          <>
            <input
              type="range"
              min={param.min ?? 0}
              max={param.max ?? 1}
              step={(param.max ?? 1) - (param.min ?? 0) > 100 ? 1 : 0.01}
              value={Number(val)}
              onChange={(e) => {
                e.stopPropagation();
                onParamChange?.(instance.id, param.id, parseFloat(e.target.value));
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{ flex: 1, minWidth: 0, accentColor: c.port, height: 12 }}
            />
            <span style={{
              fontSize: 9, color: c.text, opacity: 0.6,
              width: 28, textAlign: 'right', flexShrink: 0,
            }}>
              {typeof val === 'number' ? (val % 1 === 0 ? val : val.toFixed(1)) : val}
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: instance.position.x,
        top: instance.position.y,
        width: NODE_WIDTH,
        boxSizing: 'border-box',
        background: c.bg,
        borderRadius: 12,
        border: selected ? `2px solid ${c.port}` : `1.5px solid ${c.header}`,
        boxShadow: selected
          ? `0 4px 20px rgba(0,0,0,0.15), 0 0 0 3px ${c.header}40`
          : '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'grab',
        userSelect: 'none',
        transition: 'box-shadow 0.15s',
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(instance.id);
        const rect = e.currentTarget.getBoundingClientRect();
        onDragStart(instance.id, e.clientX - rect.left, e.clientY - rect.top);
      }}
    >
      {/* Header */}
      <div style={{
        background: c.header,
        borderRadius: expanded ? '10px 10px 0 0' : '10px 10px 0 0',
        padding: '0 10px',
        fontSize: 12,
        fontWeight: 700,
        color: c.text,
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        height: HEADER_HEIGHT,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 4,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        {hasParams && (
          <span
            onMouseDown={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            style={{
              cursor: 'pointer',
              fontSize: 14,
              opacity: expanded ? 1 : 0.5,
              flexShrink: 0,
              lineHeight: 1,
              padding: '2px 4px',
              borderRadius: 4,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = expanded ? '1' : '0.5'; }}
            title={expanded ? 'Hide properties' : 'Show properties'}
          >
            ⚙
          </span>
        )}
      </div>

      {/* Body with ports */}
      <div style={{ position: 'relative', height: bodyHeight }}>
        {inputs.map((p, i) => renderPort(p, i, 'left'))}
        {outputs.map((p, i) => renderPort(p, i, 'right'))}
      </div>

      {/* Inline visualization for Oscillator / LFO / ADSR */}
      {instance.typeId === 'oscillator' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <OscViz
            waveform={(instance.parameters.waveform as string) ?? 'sine'}
            theme={theme}
          />
        </div>
      )}
      {instance.typeId === 'lfo' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <LfoViz
            waveform={(instance.parameters.waveform as string) ?? 'sine'}
            rate={(instance.parameters.rate as number) ?? 1}
            depth={(instance.parameters.depth as number) ?? 0.5}
            theme={theme}
            visible={visible}
          />
        </div>
      )}
      {instance.typeId === 'adsr-envelope' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <AdsrViz
            a={(instance.parameters.attack as number) ?? 0.01}
            d={(instance.parameters.decay as number) ?? 0.1}
            s={(instance.parameters.sustain as number) ?? 0.7}
            r={(instance.parameters.release as number) ?? 0.3}
            theme={theme}
          />
        </div>
      )}
      {instance.typeId === 'reverb' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <ReverbViz decay={(instance.parameters.decay as number) ?? 2} theme={theme} />
        </div>
      )}
      {instance.typeId === 'distortion' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <DistortionViz amount={(instance.parameters.amount as number) ?? 20} theme={theme} />
        </div>
      )}
      {instance.typeId === 'chorus' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <ChorusViz
            rate={(instance.parameters.rate as number) ?? 1.5}
            depth={(instance.parameters.depth as number) ?? 0.5}
            theme={theme}
            visible={visible}
          />
        </div>
      )}
      {instance.typeId === 'filter' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <FilterViz
            filterType={(instance.parameters.filterType as string) ?? 'lowpass'}
            cutoff={(instance.parameters.cutoff as number) ?? 1000}
            resonance={(instance.parameters.resonance as number) ?? 1}
            theme={theme}
          />
        </div>
      )}
      {instance.typeId === 'compressor' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <CompressorViz
            threshold={(instance.parameters.threshold as number) ?? -24}
            ratio={(instance.parameters.ratio as number) ?? 12}
            knee={(instance.parameters.knee as number) ?? 30}
            theme={theme}
          />
        </div>
      )}
      {instance.typeId === 'panner' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <PannerViz
            pan={(instance.parameters.pan as number) ?? 0}
            theme={theme}
          />
        </div>
      )}
      {instance.typeId === 'eq3' && (
        <div style={{ padding: '0 10px 6px', borderTop: `1px solid ${c.header}40` }}>
          <EqViz
            lowFreq={(instance.parameters.lowFreq as number) ?? 200}
            lowGain={(instance.parameters.lowGain as number) ?? 0}
            midFreq={(instance.parameters.midFreq as number) ?? 1000}
            midGain={(instance.parameters.midGain as number) ?? 0}
            highFreq={(instance.parameters.highFreq as number) ?? 8000}
            highGain={(instance.parameters.highGain as number) ?? 0}
            theme={theme}
          />
        </div>
      )}

      {/* Expanded inline properties */}
      {expanded && hasParams && (
        <div style={{
          borderTop: `1px solid ${c.header}`,
          padding: '6px 10px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {parameters!.map(renderInlineParam)}
        </div>
      )}
    </div>
  );
});

export { NODE_WIDTH, PORT_SIZE, PORT_TYPE_COLORS, HEADER_HEIGHT, PORT_ROW_HEIGHT, BODY_PADDING_TOP, BODY_PADDING_BOTTOM };
export default GraphNode;
