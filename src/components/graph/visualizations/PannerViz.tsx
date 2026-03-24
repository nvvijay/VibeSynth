import { useRef, useEffect } from 'react';
import type { Theme } from '../../../theme';
import { VIZ_W, VIZ_H, ADSR_COLOR } from './constants';

const PANNER_COLOR = ADSR_COLOR; // utility green

export function PannerViz({ pan, theme }: { pan: number; theme: Theme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const w = VIZ_W, h = VIZ_H;
    ctx.clearRect(0, 0, w, h);
    const midX = w / 2, midY = h / 2;

    // Center line
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(midX, 4); ctx.lineTo(midX, h - 4); ctx.stroke();

    // L / R labels
    ctx.fillStyle = theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('L', 4, midY + 3);
    ctx.textAlign = 'right';
    ctx.fillText('R', w - 4, midY + 3);

    // Pan indicator — filled arc showing stereo position
    const trackLeft = 16, trackRight = w - 16;
    const trackW = trackRight - trackLeft;
    const posX = trackLeft + ((pan + 1) / 2) * trackW;

    // Track bar
    ctx.fillStyle = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    ctx.beginPath();
    ctx.roundRect(trackLeft, midY - 3, trackW, 6, 3);
    ctx.fill();

    // Active region from center to pan position
    ctx.fillStyle = PANNER_COLOR;
    ctx.globalAlpha = 0.3;
    const fromX = Math.min(midX, posX);
    const barW = Math.abs(posX - midX);
    if (barW > 1) {
      ctx.beginPath();
      ctx.roundRect(fromX, midY - 3, barW, 6, 3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Position dot
    ctx.fillStyle = PANNER_COLOR;
    ctx.beginPath();
    ctx.arc(posX, midY, 5, 0, Math.PI * 2);
    ctx.fill();
  }, [pan, theme]);
  return <canvas ref={ref} width={VIZ_W} height={VIZ_H} style={{ display: 'block' }} />;
}
