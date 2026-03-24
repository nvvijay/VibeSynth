import { useRef, useEffect } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, FX_COLOR } from './constants';

const BAND_COLORS = ['#FFB5A7', '#C4A8E0', '#B5EAD7']; // low, mid, high

/** Approximate peaking filter magnitude at a given frequency. */
function peakingMag(centerFreq: number, gainDb: number, Q: number, freq: number): number {
  const ratio = freq / centerFreq;
  const r2 = ratio * ratio;
  const q = Math.max(Q, 0.5);
  const A = Math.pow(10, gainDb / 40);
  const num = Math.sqrt((1 + (A / q) * ratio - r2) ** 2 + ((A * ratio) / q) ** 2);
  const den = Math.sqrt((1 + ratio / (q * A) - r2) ** 2 + (ratio / (q * A)) ** 2);
  return num / den;
}

export function EqViz({ lowFreq, lowGain, midFreq, midGain, highFreq, highGain, theme }: {
  lowFreq: number; lowGain: number; midFreq: number; midGain: number;
  highFreq: number; highGain: number; theme: Theme;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const minF = 20, maxF = 20000;
    const dbMin = -15, dbMax = 15;
    const toY = (db: number) => {
      const clamped = Math.max(dbMin, Math.min(dbMax, db));
      return h * (1 - (clamped - dbMin) / (dbMax - dbMin));
    };

    // 0dB line
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    const zeroY = toY(0);
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke();

    const bands = [
      { freq: lowFreq, gain: lowGain, color: BAND_COLORS[0] },
      { freq: midFreq, gain: midGain, color: BAND_COLORS[1] },
      { freq: highFreq, gain: highGain, color: BAND_COLORS[2] },
    ];

    // Draw individual band curves (faint)
    for (const band of bands) {
      ctx.beginPath();
      ctx.strokeStyle = band.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      for (let px = 0; px <= w; px++) {
        const freq = minF * Math.pow(maxF / minF, px / w);
        const mag = peakingMag(band.freq, band.gain, 1, freq);
        const db = 20 * Math.log10(Math.max(mag, 1e-10));
        const py = toY(db);
        px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Combined response curve
    ctx.beginPath();
    ctx.strokeStyle = FX_COLOR;
    ctx.lineWidth = 2;
    for (let px = 0; px <= w; px++) {
      const freq = minF * Math.pow(maxF / minF, px / w);
      let totalDb = 0;
      for (const band of bands) {
        const mag = peakingMag(band.freq, band.gain, 1, freq);
        totalDb += 20 * Math.log10(Math.max(mag, 1e-10));
      }
      const py = toY(totalDb);
      px === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Fill under combined curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = FX_COLOR;
    ctx.fill();
    ctx.globalAlpha = 1;
  }, [lowFreq, lowGain, midFreq, midGain, highFreq, highGain, theme]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
