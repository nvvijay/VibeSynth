import { useRef, useEffect, useCallback, useState } from 'react';
import type { Theme } from '../../theme';

const CATEGORY_COLORS: Record<string, string> = {
  source: '#FFB5A7',
  effect: '#F0D86E',
  modulator: '#C4A8E0',
  utility: '#8DD4B8',
};

const DEFAULT_COLOR = '#C4A8E0';

export interface VisualizerProps {
  analyserNode: AnalyserNode | null;
  category?: string;
  width?: number;
  height?: number;
  theme?: Theme;
}

export function Visualizer({
  analyserNode,
  category,
  width = 300,
  height = 100,
  theme,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [isRunning, setIsRunning] = useState(false);

  const strokeColor = category ? (CATEGORY_COLORS[category] ?? DEFAULT_COLOR) : DEFAULT_COLOR;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Background
    const bgColor = theme?.isDark ? '#1e1e34' : '#FFF8F0';
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 12);
    ctx.fill();

    if (!analyserNode) {
      // Flat line at zero amplitude
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    const bufferLength = analyserNode.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyserNode.getFloatTimeDomainData(dataArray);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i];
      const y = (1 - v) * height / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, width, height, strokeColor, theme]);

  useEffect(() => {
    if (analyserNode) {
      setIsRunning(true);
      animFrameRef.current = requestAnimationFrame(draw);
    } else {
      setIsRunning(false);
      // Draw flat line once
      draw();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [analyserNode, draw]);

  const borderColor = theme?.border ?? '#F0E6DD';
  const mutedColor = theme?.textMuted ?? '#A89AAF';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      alignItems: 'center',
    }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          borderRadius: 12,
          border: `1px solid ${borderColor}`,
          boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        }}
      />
      <div style={{
        fontSize: 10,
        color: mutedColor,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: isRunning ? '#8DD4B8' : (theme?.isDark ? '#3a3a5a' : '#E0D5CC'),
          display: 'inline-block',
        }} />
        {isRunning ? 'Live' : 'No signal'}
      </div>
    </div>
  );
}

export function getStageColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

export default Visualizer;
