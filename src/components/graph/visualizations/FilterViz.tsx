import { useRef, useEffect } from 'react';
import type { Theme } from '../../../theme';
import { computeFilterMagnitude } from '../../../engine/audio/dsp-utils.ts';
import { VIZ_W, VIZ_H, FX_COLOR, FILTER_VIZ_COLORS } from './constants';

export function FilterViz({ filterType, cutoff, resonance, theme }: {
  filterType: string; cutoff: number; resonance: number; theme: Theme;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const color = FILTER_VIZ_COLORS[filterType] ?? FX_COLOR;
    const minF = 20, maxF = 20000;
    const dbMin = -36, dbMax = 12;
    const toY = (db: number) => {
      const clamped = Math.max(dbMin, Math.min(dbMax, db));
      return h * (1 - (clamped - dbMin) / (dbMax - dbMin));
    };
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    const zeroY = toY(0);
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke();
    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const freq = minF * Math.pow(maxF / minF, px / w);
      const mag = computeFilterMagnitude(filterType, cutoff, resonance, freq);
      const db = 20 * Math.log10(Math.max(mag, 1e-10));
      const py = toY(db);
      px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    const cx = w * Math.log10(cutoff / minF) / Math.log10(maxF / minF);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }, [filterType, cutoff, resonance, theme]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
