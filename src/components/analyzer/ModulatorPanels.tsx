import { useRef, useEffect, useCallback } from 'react';
import type { AudioGraph } from '../../engine/audio/AudioGraph';
import type { Theme } from '../../theme';

interface ModulatorPanelsProps {
  graph: AudioGraph;
  theme: Theme;
}

const LFO_COLOR = '#C4A8E0';
const ADSR_COLOR = '#8DD4B8';
const PANEL_W = 200;
const LFO_H = 100;
const ADSR_H = 110;

interface LfoData { waveform: string; rate: number; depth: number; }
interface AdsrData { attack: number; decay: number; sustain: number; release: number; }

function LfoCanvas({ lfo, theme }: { lfo: LfoData; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef(performance.now() / 1000);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = PANEL_W;
    const h = LFO_H;

    ctx.clearRect(0, 0, w, h);

    // Title + info
    ctx.fillStyle = LFO_COLOR;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LFO', 8, 14);
    ctx.fillStyle = theme.textMuted;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${lfo.waveform} ${lfo.rate.toFixed(1)}Hz d:${lfo.depth.toFixed(2)}`, w - 8, 14);

    // Waveform
    const waveX = 8, waveY = 22, waveW = w - 16, waveH = h - 30;
    const midY = waveY + waveH / 2;

    // Center line
    ctx.strokeStyle = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(waveX, midY);
    ctx.lineTo(waveX + waveW, midY);
    ctx.stroke();

    const time = performance.now() / 1000 - startRef.current;
    const phase = time * lfo.rate * 2 * Math.PI;
    ctx.beginPath();
    ctx.strokeStyle = LFO_COLOR;
    ctx.lineWidth = 2;
    for (let px = 0; px <= waveW; px++) {
      const t = (px / waveW) * 2 * Math.PI * 2 + phase;
      let val = 0;
      switch (lfo.waveform) {
        case 'sine': val = Math.sin(t); break;
        case 'square': val = Math.sin(t) >= 0 ? 1 : -1; break;
        case 'sawtooth': val = 2 * ((t / (2 * Math.PI)) % 1) - 1; break;
        case 'triangle': val = 2 * Math.abs(2 * ((t / (2 * Math.PI)) % 1) - 1) - 1; break;
        default: val = Math.sin(t);
      }
      val *= lfo.depth;
      const py = midY - val * (waveH / 2) * 0.9;
      if (px === 0) ctx.moveTo(waveX + px, py);
      else ctx.lineTo(waveX + px, py);
    }
    ctx.stroke();

    animRef.current = requestAnimationFrame(draw);
  }, [lfo, theme]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  return <canvas ref={canvasRef} width={PANEL_W} height={LFO_H} />;
}

function AdsrCanvas({ adsr, theme }: { adsr: AdsrData; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = PANEL_W;
    const h = ADSR_H;

    ctx.clearRect(0, 0, w, h);

    // Title + info
    ctx.fillStyle = ADSR_COLOR;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ADSR', 8, 14);
    ctx.fillStyle = theme.textMuted;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `A:${adsr.attack.toFixed(2)} D:${adsr.decay.toFixed(2)} S:${adsr.sustain.toFixed(2)} R:${adsr.release.toFixed(2)}`,
      w - 8, 14,
    );

    // Envelope
    const envX = 12, envY = 24, envW = w - 24, envH = h - 40;
    const baseY = envY + envH;
    const totalTime = adsr.attack + adsr.decay + 0.3 + adsr.release;
    const aW = (adsr.attack / totalTime) * envW;
    const dW = (adsr.decay / totalTime) * envW;
    const sW = (0.3 / totalTime) * envW;
    const rW = (adsr.release / totalTime) * envW;
    const peakY = envY;
    const sustainY = envY + envH * (1 - adsr.sustain);

    // Fill
    ctx.beginPath();
    ctx.moveTo(envX, baseY);
    ctx.lineTo(envX + aW, peakY);
    ctx.lineTo(envX + aW + dW, sustainY);
    ctx.lineTo(envX + aW + dW + sW, sustainY);
    ctx.lineTo(envX + aW + dW + sW + rW, baseY);
    ctx.closePath();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = ADSR_COLOR;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Outline
    ctx.beginPath();
    ctx.moveTo(envX, baseY);
    ctx.lineTo(envX + aW, peakY);
    ctx.lineTo(envX + aW + dW, sustainY);
    ctx.lineTo(envX + aW + dW + sW, sustainY);
    ctx.lineTo(envX + aW + dW + sW + rW, baseY);
    ctx.strokeStyle = ADSR_COLOR;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Phase labels
    ctx.fillStyle = theme.textMuted;
    ctx.font = '8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.6;
    if (aW > 12) ctx.fillText('A', envX + aW / 2, baseY + 12);
    if (dW > 12) ctx.fillText('D', envX + aW + dW / 2, baseY + 12);
    if (sW > 12) ctx.fillText('S', envX + aW + dW + sW / 2, baseY + 12);
    if (rW > 12) ctx.fillText('R', envX + aW + dW + sW + rW / 2, baseY + 12);
    ctx.globalAlpha = 1;

    // Sustain dashed line
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = ADSR_COLOR;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(envX, sustainY);
    ctx.lineTo(envX + envW, sustainY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }, [adsr, theme]);

  return <canvas ref={canvasRef} width={PANEL_W} height={ADSR_H} />;
}

export function ModulatorPanels({ graph, theme }: ModulatorPanelsProps) {
  const modules = graph.getModules();
  const lfos: LfoData[] = [];
  const adsrs: AdsrData[] = [];

  for (const mod of modules) {
    if (mod.typeId === 'lfo') {
      lfos.push({
        waveform: (mod.parameters.waveform as string) ?? 'sine',
        rate: (mod.parameters.rate as number) ?? 1,
        depth: (mod.parameters.depth as number) ?? 0.5,
      });
    }
    if (mod.typeId === 'adsr-envelope') {
      adsrs.push({
        attack: (mod.parameters.attack as number) ?? 0.01,
        decay: (mod.parameters.decay as number) ?? 0.1,
        sustain: (mod.parameters.sustain as number) ?? 0.7,
        release: (mod.parameters.release as number) ?? 0.3,
      });
    }
  }

  if (lfos.length === 0 && adsrs.length === 0) return null;

  const panelStyle: React.CSSProperties = {
    background: theme.isDark ? 'rgba(18,18,31,0.85)' : 'rgba(255,250,245,0.85)',
    borderRadius: 12,
    border: `1px solid ${theme.border}`,
    overflow: 'hidden',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
      {lfos.map((lfo, i) => (
        <div key={`lfo-${i}`} style={panelStyle}>
          <LfoCanvas lfo={lfo} theme={theme} />
        </div>
      ))}
      {adsrs.map((adsr, i) => (
        <div key={`adsr-${i}`} style={panelStyle}>
          <AdsrCanvas adsr={adsr} theme={theme} />
        </div>
      ))}
    </div>
  );
}

export default ModulatorPanels;
