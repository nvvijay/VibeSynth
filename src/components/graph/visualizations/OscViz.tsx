import { useRef, useEffect } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, OSC_COLOR } from './constants';

export function OscViz({ waveform, theme }: { waveform: string; theme: Theme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = OSC_COLOR;
    ctx.lineWidth = 1.5;
    for (let px = 0; px <= w; px++) {
      const t = (px / w) * 4 * Math.PI;
      let v = 0;
      switch (waveform) {
        case 'sine': v = Math.sin(t); break;
        case 'square': v = Math.sin(t) >= 0 ? 1 : -1; break;
        case 'sawtooth': v = 2 * ((t / (2 * Math.PI)) % 1) - 1; break;
        case 'triangle': v = 2 * Math.abs(2 * ((t / (2 * Math.PI)) % 1) - 1) - 1; break;
        default: v = Math.sin(t);
      }
      const py = mid - v * (h / 2) * 0.85;
      px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.lineTo(w, mid);
    ctx.lineTo(0, mid);
    ctx.closePath();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = OSC_COLOR;
    ctx.fill();
    ctx.globalAlpha = 1;
  }, [waveform, theme]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
