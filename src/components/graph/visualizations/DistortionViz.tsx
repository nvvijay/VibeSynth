import { useRef, useEffect } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, FX_COLOR } from './constants';

export function DistortionViz({ amount, theme }: { amount: number; theme: Theme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const pad = 4;
    const pw = w - pad * 2, ph = h - pad * 2;
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad + ph);
    ctx.lineTo(pad + pw, pad);
    ctx.stroke();
    const k = amount;
    ctx.beginPath();
    ctx.strokeStyle = FX_COLOR;
    ctx.lineWidth = 2;
    for (let px = 0; px <= pw; px++) {
      const x = (px / pw) * 2 - 1;
      const shaped = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
      const clamped = Math.max(-1, Math.min(1, shaped));
      const py = pad + ph * (1 - (clamped + 1) / 2);
      px === 0 ? ctx.moveTo(pad + px, py) : ctx.lineTo(pad + px, py);
    }
    ctx.stroke();
  }, [amount, theme]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
