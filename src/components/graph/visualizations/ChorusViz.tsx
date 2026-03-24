import { useRef, useEffect, useCallback } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, FX_COLOR } from './constants';

export function ChorusViz({ rate, depth, theme, visible = true }: {
  rate: number; depth: number; theme: Theme; visible?: boolean;
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
    const time = performance.now() / 1000 - t0.current;
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    ctx.setLineDash([]);
    const phase = time * rate * 2 * Math.PI;
    ctx.beginPath();
    ctx.strokeStyle = FX_COLOR;
    ctx.lineWidth = 1.5;
    for (let px = 0; px <= w; px++) {
      const t = (px / w) * 6 * Math.PI;
      const modulation = Math.sin(t * 0.3 + phase) * depth;
      const v = Math.sin(t + modulation * 2);
      const py = mid - v * (h / 2) * 0.7;
      px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = FX_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    for (let px = 0; px <= w; px++) {
      const t = (px / w) * 6 * Math.PI;
      const modulation = Math.sin(t * 0.3 + phase + 1.5) * depth;
      const v = Math.sin(t + 0.3 + modulation * 2);
      const py = mid - v * (h / 2) * 0.7;
      px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (visible) animRef.current = requestAnimationFrame(draw);
  }, [rate, depth, theme, visible]);
  useEffect(() => {
    if (visible) {
      animRef.current = requestAnimationFrame(draw);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, visible]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
