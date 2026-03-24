import { useRef, useEffect } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, FX_COLOR } from './constants';

export function CompressorViz({ threshold, ratio, knee, theme }: {
  threshold: number; ratio: number; knee: number; theme: Theme;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const pad = 4;
    const pw = w - pad * 2, ph = h - pad * 2;
    const dbMin = -60, dbMax = 0;
    const toX = (db: number) => pad + ((db - dbMin) / (dbMax - dbMin)) * pw;
    const toY = (db: number) => pad + ph - ((db - dbMin) / (dbMax - dbMin)) * ph;

    // Unity line (1:1)
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toX(dbMin), toY(dbMin));
    ctx.lineTo(toX(dbMax), toY(dbMax));
    ctx.stroke();

    // Threshold marker
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = FX_COLOR;
    ctx.globalAlpha = 0.4;
    const tx = toX(threshold);
    ctx.beginPath(); ctx.moveTo(tx, pad); ctx.lineTo(tx, pad + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Compression curve
    ctx.beginPath();
    ctx.strokeStyle = FX_COLOR;
    ctx.lineWidth = 2;
    for (let px = 0; px <= pw; px++) {
      const inputDb = dbMin + (px / pw) * (dbMax - dbMin);
      let outputDb: number;
      const kneeHalf = knee / 2;
      if (inputDb < threshold - kneeHalf) {
        outputDb = inputDb;
      } else if (inputDb > threshold + kneeHalf) {
        outputDb = threshold + (inputDb - threshold) / ratio;
      } else {
        // Soft knee region
        const x = inputDb - threshold + kneeHalf;
        outputDb = inputDb + ((1 / ratio - 1) * x * x) / (2 * knee);
      }
      const py = toY(outputDb);
      px === 0 ? ctx.moveTo(pad + px, py) : ctx.lineTo(pad + px, py);
    }
    ctx.stroke();
  }, [threshold, ratio, knee, theme]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
