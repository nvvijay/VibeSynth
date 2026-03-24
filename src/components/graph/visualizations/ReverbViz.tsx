import { useRef, useEffect } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, FX_COLOR } from './constants';

export function ReverbViz({ decay, theme }: { decay: number; theme: Theme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const base = h - 4;
    const top = 4;
    ctx.beginPath();
    ctx.moveTo(4, base);
    ctx.lineTo(4, top);
    const tailLen = w - 8;
    const rate = Math.max(0.5, decay);
    for (let px = 0; px <= tailLen; px++) {
      const t = px / tailLen;
      const amp = Math.exp(-t * 4 / rate) * (1 - t * 0.1);
      const noise = (Math.sin(px * 7.3) * 0.3 + Math.sin(px * 13.1) * 0.2) * amp;
      const py = base - Math.max(0, amp + noise) * (base - top) * 0.9;
      ctx.lineTo(4 + px, py);
    }
    ctx.lineTo(w - 4, base);
    ctx.closePath();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = FX_COLOR;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(4, base);
    ctx.lineTo(4, top);
    for (let px = 0; px <= tailLen; px++) {
      const t = px / tailLen;
      const amp = Math.exp(-t * 4 / rate);
      const py = base - amp * (base - top) * 0.9;
      ctx.lineTo(4 + px, py);
    }
    ctx.strokeStyle = FX_COLOR;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [decay, theme]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
