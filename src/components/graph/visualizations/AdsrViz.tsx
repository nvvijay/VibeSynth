import { useRef, useEffect } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, ADSR_COLOR } from './constants';

export function AdsrViz({ a, d, s, r, theme }: {
  a: number; d: number; s: number; r: number; theme: Theme;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const pad = 4;
    const pw = w - pad * 2, ph = h - pad * 2;
    const base = pad + ph;
    const total = a + d + 0.25 + r;
    const aW = (a / total) * pw, dW = (d / total) * pw, sW = (0.25 / total) * pw, rW = (r / total) * pw;
    const peak = pad, sus = pad + ph * (1 - s);
    ctx.beginPath();
    ctx.moveTo(pad, base);
    ctx.lineTo(pad + aW, peak);
    ctx.lineTo(pad + aW + dW, sus);
    ctx.lineTo(pad + aW + dW + sW, sus);
    ctx.lineTo(pad + aW + dW + sW + rW, base);
    ctx.closePath();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = ADSR_COLOR;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(pad, base);
    ctx.lineTo(pad + aW, peak);
    ctx.lineTo(pad + aW + dW, sus);
    ctx.lineTo(pad + aW + dW + sW, sus);
    ctx.lineTo(pad + aW + dW + sW + rW, base);
    ctx.strokeStyle = ADSR_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.moveTo(pad, sus); ctx.lineTo(pad + pw, sus); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }, [a, d, s, r, theme]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
