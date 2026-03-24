import { useRef, useEffect, useCallback } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, LFO_COLOR } from './constants';

export function LfoViz({ waveform, rate, depth, theme, visible = true }: {
  waveform: string; rate: number; depth: number; theme: Theme; visible?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const t0 = useRef(performance.now() / 1000);
  const draw = useCallback(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    const phase = (performance.now() / 1000 - t0.current) * rate * 2 * Math.PI;
    ctx.beginPath();
    ctx.strokeStyle = LFO_COLOR;
    ctx.lineWidth = 1.5;
    for (let px = 0; px <= w; px++) {
      const t = (px / w) * 4 * Math.PI + phase;
      let v = 0;
      switch (waveform) {
        case 'sine': v = Math.sin(t); break;
        case 'square': v = Math.sin(t) >= 0 ? 1 : -1; break;
        case 'sawtooth': v = 2 * ((t / (2 * Math.PI)) % 1) - 1; break;
        case 'triangle': v = 2 * Math.abs(2 * ((t / (2 * Math.PI)) % 1) - 1) - 1; break;
        default: v = Math.sin(t);
      }
      v *= depth;
      const py = mid - v * (h / 2) * 0.85;
      px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (visible) animRef.current = requestAnimationFrame(draw);
  }, [waveform, rate, depth, theme, visible]);
  useEffect(() => {
    if (visible) {
      animRef.current = requestAnimationFrame(draw);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, visible]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
