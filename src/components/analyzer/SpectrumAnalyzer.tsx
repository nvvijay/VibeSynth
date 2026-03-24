import { useRef, useEffect, useCallback } from 'react';
import type { AudioGraph } from '../../engine/audio/AudioGraph';
import type { ModuleRegistry } from '../../engine/audio/ModuleRegistry';
import type { Theme } from '../../theme';
import { computeFilterMagnitude } from '../../engine/audio/dsp-utils.ts';

export interface SpectrumAnalyzerProps {
  analyserNode: AnalyserNode | null;
  graph: AudioGraph;
  registry: ModuleRegistry;
  width?: number;
  height?: number;
  theme: Theme;
  visible?: boolean;
}

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const DB_MIN = -90;
const DB_MAX = 0;
const FREQ_LABELS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

function freqToX(freq: number, w: number): number {
  return (Math.log10(freq / MIN_FREQ) / Math.log10(MAX_FREQ / MIN_FREQ)) * w;
}

function dbToY(db: number, h: number, top: number): number {
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
  return top + (1 - (clamped - DB_MIN) / (DB_MAX - DB_MIN)) * h;
}

function formatFreq(f: number): string {
  return f >= 1000 ? `${f / 1000}k` : `${f}`;
}

interface FilterOverlay {
  name: string;
  type: string;
  cutoff: number;
  resonance: number;
  color: string;
}

const FILTER_COLORS: Record<string, string> = {
  lowpass: '#FFB5A7',
  highpass: '#B5EAD7',
  bandpass: '#D4C4E8',
  notch: '#F5E6A3',
};



export function SpectrumAnalyzer({
  analyserNode, graph, registry, width = 800, height = 400, theme, visible = true,
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const getFilterOverlays = useCallback((): FilterOverlay[] => {
    const overlays: FilterOverlay[] = [];
    for (const mod of graph.getModules()) {
      if (mod.typeId === 'filter') {
        const def = registry.get(mod.typeId);
        overlays.push({
          name: def?.name ?? 'Filter',
          type: (mod.parameters.filterType as string) ?? 'lowpass',
          cutoff: (mod.parameters.cutoff as number) ?? 1000,
          resonance: (mod.parameters.resonance as number) ?? 1,
          color: FILTER_COLORS[(mod.parameters.filterType as string) ?? 'lowpass'] ?? '#FFB5A7',
        });
      }
    }
    return overlays;
  }, [graph, registry]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pad = { top: 30, right: 20, bottom: 40, left: 50 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // Clear
    ctx.clearRect(0, 0, width, height);
    const bg = theme.isDark ? '#12121f' : '#FFFAF5';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 16);
    ctx.fill();

    // Grid lines
    ctx.save();
    ctx.translate(pad.left, 0);

    // Vertical freq grid
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (const f of FREQ_LABELS) {
      const x = freqToX(f, plotW);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
    }

    // Horizontal dB grid
    const dbSteps = [-80, -60, -40, -20, 0];
    for (const db of dbSteps) {
      const y = dbToY(db, plotH, pad.top);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotW, y);
      ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = theme.textMuted;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const f of FREQ_LABELS) {
      const x = freqToX(f, plotW);
      ctx.fillText(formatFreq(f), x, pad.top + plotH + 16);
    }
    ctx.textAlign = 'right';
    for (const db of dbSteps) {
      const y = dbToY(db, plotH, pad.top);
      ctx.fillText(`${db}`, -6, y + 3);
    }

    // Title labels
    ctx.fillStyle = theme.textMuted;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Frequency (Hz)', plotW / 2, height - 4);
    ctx.save();
    ctx.translate(-38, pad.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Magnitude (dB)', 0, 0);
    ctx.restore();

    // FFT spectrum
    if (analyserNode) {
      const binCount = analyserNode.frequencyBinCount;
      const fftData = new Float32Array(binCount);
      analyserNode.getFloatFrequencyData(fftData);
      const sampleRate = analyserNode.context.sampleRate;

      ctx.beginPath();
      ctx.moveTo(0, pad.top + plotH);
      let started = false;
      for (let i = 1; i < binCount; i++) {
        const freq = (i * sampleRate) / (binCount * 2);
        if (freq < MIN_FREQ || freq > MAX_FREQ) continue;
        const x = freqToX(freq, plotW);
        const db = fftData[i];
        const y = dbToY(db, plotH, pad.top);
        if (!started) {
          ctx.moveTo(x, pad.top + plotH);
          ctx.lineTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(plotW, pad.top + plotH);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      if (theme.isDark) {
        grad.addColorStop(0, 'rgba(196,168,224,0.6)');
        grad.addColorStop(0.5, 'rgba(255,181,167,0.3)');
        grad.addColorStop(1, 'rgba(255,181,167,0.05)');
      } else {
        grad.addColorStop(0, 'rgba(196,168,224,0.5)');
        grad.addColorStop(0.5, 'rgba(255,181,167,0.25)');
        grad.addColorStop(1, 'rgba(255,181,167,0.02)');
      }
      ctx.fillStyle = grad;
      ctx.fill();

      // Spectrum outline
      ctx.beginPath();
      started = false;
      for (let i = 1; i < binCount; i++) {
        const freq = (i * sampleRate) / (binCount * 2);
        if (freq < MIN_FREQ || freq > MAX_FREQ) continue;
        const x = freqToX(freq, plotW);
        const y = dbToY(fftData[i], plotH, pad.top);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = theme.isDark ? 'rgba(196,168,224,0.8)' : 'rgba(180,140,210,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Filter overlays
    const filters = getFilterOverlays();
    for (const f of filters) {
      ctx.beginPath();
      let first = true;
      for (let px = 0; px <= plotW; px += 2) {
        const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, px / plotW);
        const mag = computeFilterMagnitude(f.type, f.cutoff, f.resonance, freq);
        const db = 20 * Math.log10(Math.max(mag, 1e-10));
        const y = dbToY(db, plotH, pad.top);
        if (first) { ctx.moveTo(px, y); first = false; }
        else ctx.lineTo(px, y);
      }
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.85;
      ctx.stroke();

      ctx.lineTo(plotW, pad.top + plotH);
      ctx.lineTo(0, pad.top + plotH);
      ctx.closePath();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = f.color;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Cutoff marker
      const cx = freqToX(f.cutoff, plotW);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Legend (top-right, for filters)
    const legendItems: Array<{ color: string; label: string }> = [];
    for (const f of filters) {
      legendItems.push({ color: f.color, label: `${f.type} ${formatFreq(f.cutoff)}Hz Q:${f.resonance.toFixed(1)}` });
    }
    if (legendItems.length > 0) {
      const legendX = width - pad.right - 10;
      let legendY = pad.top + 10;
      ctx.textAlign = 'right';
      ctx.font = '10px system-ui, sans-serif';
      for (const item of legendItems) {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX - 50, legendY - 4, 12, 3);
        ctx.fillStyle = theme.text;
        ctx.fillText(item.label, legendX, legendY);
        legendY += 16;
      }
    }

    // LFO and ADSR panels are rendered outside the canvas as React elements

    if (visible) animRef.current = requestAnimationFrame(draw);
  }, [analyserNode, width, height, theme, getFilterOverlays, visible]);

  useEffect(() => {
    if (visible) {
      animRef.current = requestAnimationFrame(draw);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw, visible]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        borderRadius: 16,
        border: `1px solid ${theme.border}`,
        boxShadow: theme.isDark
          ? '0 4px 24px rgba(0,0,0,0.4)'
          : '0 4px 24px rgba(0,0,0,0.08)',
      }}
    />
  );
}

export default SpectrumAnalyzer;
