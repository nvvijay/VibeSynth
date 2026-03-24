import type {
  ConnectionDescriptor,
  ModuleInstance,
  ParameterDefinition,
  PortDefinition,
} from '../../types';
import type { ModuleRegistry } from './ModuleRegistry';
import { makeDistortionCurve, createImpulseResponse } from './dsp-utils.ts';
import {
  IncompatiblePortError,
  PortNotFoundError,
  UnknownModuleTypeError,
} from '../errors';
import { VoiceAllocator } from './VoiceAllocator';

// ID generation is now per-instance on AudioGraph class

interface VoiceState {
  noteNumber: number;
  /** Per oscillator-module: [OscillatorNode, GainNode (gate)] */
  oscNodes: Map<string, [OscillatorNode, GainNode]>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Resolves which AudioNode is the "input" node for a module (first node)
 * and which is the "output" node (last node).
 */
function getInputNode(nodes: AudioNode[]): AudioNode | null {
  return nodes.length > 0 ? nodes[0] : null;
}

function getOutputNode(nodes: AudioNode[]): AudioNode | null {
  return nodes.length > 0 ? nodes[nodes.length - 1] : null;
}

export class AudioGraph {
  private modules = new Map<string, ModuleInstance>();
  private connections = new Map<string, ConnectionDescriptor>();
  private registry: ModuleRegistry;
  private audioContext: AudioContext | null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voiceAllocator = new VoiceAllocator(8);
  private activeVoices = new Map<number, VoiceState>();
  private idCounter = 0;

  private generateId(prefix: string): string {
    return `${prefix}-${++this.idCounter}`;
  }

  constructor(registry: ModuleRegistry, audioContext?: AudioContext) {
    this.registry = registry;
    this.audioContext = audioContext ?? null;
    if (this.audioContext) {
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5;
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  addModule(
    typeId: string,
    position: { x: number; y: number },
  ): ModuleInstance {
    const definition = this.registry.get(typeId);
    if (!definition) {
      throw new UnknownModuleTypeError(typeId);
    }

    const parameters: Record<string, number | string> = {};
    for (const param of definition.parameters) {
      parameters[param.id] = param.defaultValue;
    }

    // Create real audio nodes if we have an AudioContext
    let audioNodes: AudioNode[] = [];
    if (this.audioContext) {
      try {
        const result = definition.createAudioNode(this.audioContext, parameters);
        audioNodes = Array.isArray(result) ? result : [result];
      } catch (err) {
        console.warn(`Failed to create audio nodes for ${typeId}:`, err);
      }
    }

    const instance: ModuleInstance = {
      id: this.generateId('mod'),
      typeId: definition.typeId,
      audioNodes,
      parameters,
      ports: definition.ports.map((p: PortDefinition) => ({ ...p })),
      position: { ...position },
    };

    this.modules.set(instance.id, instance);

    // Auto-connect "output" (Speaker) modules to master gain
    if (typeId === 'output' && this.masterGain && audioNodes.length > 0) {
      try {
        const outNode = audioNodes[audioNodes.length - 1];
        outNode?.connect(this.masterGain);
      } catch { /* already connected */ }
    }

    return instance;
  }

  removeModule(moduleId: string): void {
    const mod = this.modules.get(moduleId);
    if (!mod) return;

    // Clean up any voice nodes referencing this module
    if (mod.typeId === 'oscillator') {
      for (const vs of this.activeVoices.values()) {
        const pair = vs.oscNodes.get(moduleId);
        if (pair) {
          try { pair[0].stop(); } catch { /* */ }
          try { pair[0].disconnect(); } catch { /* */ }
          try { pair[1].disconnect(); } catch { /* */ }
          vs.oscNodes.delete(moduleId);
        }
      }
    }

    // Cascade-delete all connections involving this module
    const connIds = [...this.connections.keys()];
    for (const connId of connIds) {
      const conn = this.connections.get(connId)!;
      if (conn.sourceModuleId === moduleId || conn.targetModuleId === moduleId) {
        this.disconnectAudio(conn);
        this.connections.delete(connId);
      }
    }

    // Stop and disconnect audio nodes
    for (const node of mod.audioNodes) {
      try {
        node.disconnect();
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
      } catch {
        // Already stopped or disconnected
      }
    }

    this.modules.delete(moduleId);
  }

  connect(
    sourceModuleId: string,
    sourcePortId: string,
    targetModuleId: string,
    targetPortId: string,
  ): ConnectionDescriptor {
    const sourcePort = this.findPort(sourceModuleId, sourcePortId, 'output');
    const targetPort = this.findPort(targetModuleId, targetPortId, 'input');

    if (sourcePort.type !== targetPort.type) {
      throw new IncompatiblePortError(sourcePort.type, targetPort.type);
    }

    const descriptor: ConnectionDescriptor = {
      id: this.generateId('conn'),
      sourceModuleId,
      sourcePortId,
      targetModuleId,
      targetPortId,
    };

    this.connections.set(descriptor.id, descriptor);

    // Actually connect the Web Audio nodes
    this.connectAudio(descriptor);

    return descriptor;
  }

  disconnect(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      this.disconnectAudio(conn);
    }
    this.connections.delete(connectionId);
  }

  setParameter(
    moduleId: string,
    paramId: string,
    value: number | string,
  ): void {
    const mod = this.modules.get(moduleId);
    if (!mod) {
      throw new PortNotFoundError(moduleId, paramId);
    }

    const definition = this.registry.get(mod.typeId);
    const paramDef = definition?.parameters.find((p: ParameterDefinition) => p.id === paramId);
    if (!paramDef) {
      throw new PortNotFoundError(moduleId, paramId);
    }

    if (paramDef.type === 'number' && typeof value === 'number') {
      if (paramDef.min != null && value < paramDef.min) value = paramDef.min;
      if (paramDef.max != null && value > paramDef.max) value = paramDef.max;
    }

    mod.parameters[paramId] = value;

    // Live-update audio node parameters
    if (this.audioContext && mod.audioNodes.length > 0) {
      this.applyParameterToNodes(mod, paramId, value);
    }
  }

  /**
   * Connect a module's output directly to the master gain (for quick playback).
   */
  connectToMaster(moduleId: string): void {
    const mod = this.modules.get(moduleId);
    if (!mod || !this.masterGain) return;
    const outNode = this.resolveOutputNode(mod);
    if (outNode) {
      try { outNode.connect(this.masterGain); } catch { /* already connected */ }
    }
  }

  /**
   * Disconnect a module from the master gain.
   */
  disconnectFromMaster(moduleId: string): void {
    const mod = this.modules.get(moduleId);
    if (!mod || !this.masterGain) return;
    const outNode = this.resolveOutputNode(mod);
    if (outNode) {
      try { outNode.disconnect(this.masterGain); } catch { /* not connected */ }
    }
  }

  /**
   * Set the maximum number of simultaneous voices.
   */
  setPolyphony(count: number): void {
    this.voiceAllocator.setMaxVoices(count);
  }

  getPolyphony(): number {
    return this.voiceAllocator.maxVoices;
  }

  /**
   * Allocate a voice, create per-voice oscillator nodes, apply ADSR envelope to gates.
   */
  triggerNoteOn(noteNumber: number, _velocity: number): void {
    if (!this.audioContext) return;
    const voice = this.voiceAllocator.allocate(noteNumber, _velocity);

    // Clean up stolen voice
    const existing = this.activeVoices.get(voice.id);
    if (existing) this.cleanupVoice(existing);

    const freq = 440 * Math.pow(2, (noteNumber - 69) / 12);
    const now = this.audioContext.currentTime;
    const adsr = this.getAdsrParams();

    const voiceState: VoiceState = { noteNumber, oscNodes: new Map() };

    for (const mod of this.modules.values()) {
      if (mod.typeId !== 'oscillator') continue;

      // Create per-voice osc + gate
      const osc = this.audioContext.createOscillator();
      osc.type = (mod.parameters.waveform as OscillatorType) || 'sine';
      osc.detune.value = (mod.parameters.detune as number) || 0;
      osc.frequency.setValueAtTime(freq, now);

      const gate = this.audioContext.createGain();
      gate.gain.setValueAtTime(0, now);
      gate.gain.linearRampToValueAtTime(1, now + adsr.attack);
      gate.gain.setTargetAtTime(adsr.sustain, now + adsr.attack, Math.max(adsr.decay / 3, 0.001));

      osc.connect(gate);
      osc.start(now);

      // Wire gate to wherever the original oscillator connects
      this.connectVoiceGate(mod.id, gate);
      voiceState.oscNodes.set(mod.id, [osc, gate]);
    }

    // Set ADSR modules to passthrough (envelope is on per-voice gates)
    for (const mod of this.modules.values()) {
      if (mod.typeId === 'adsr-envelope') {
        const g = mod.audioNodes[0];
        if (g instanceof GainNode) {
          g.gain.cancelScheduledValues(now);
          g.gain.setValueAtTime(1, now);
        }
      }
    }

    this.activeVoices.set(voice.id, voiceState);
  }

  /**
   * Release the voice playing this note — apply ADSR release, then clean up.
   */
  triggerNoteOff(noteNumber: number): void {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const adsr = this.getAdsrParams();

    for (const [voiceId, vs] of this.activeVoices) {
      if (vs.noteNumber !== noteNumber || vs.cleanupTimer) continue;

      for (const [, [, gate]] of vs.oscNodes) {
        gate.gain.cancelScheduledValues(now);
        gate.gain.setValueAtTime(gate.gain.value, now);
        gate.gain.setTargetAtTime(0, now, Math.max(adsr.release / 3, 0.001));
      }

      // Schedule cleanup after release tail
      vs.cleanupTimer = setTimeout(() => {
        this.cleanupVoice(vs);
        this.activeVoices.delete(voiceId);
      }, (adsr.release + 0.2) * 1000);

      this.voiceAllocator.release(noteNumber);
      return; // release first matching voice only
    }
  }

  getModules(): ModuleInstance[] {
    return Array.from(this.modules.values());
  }

  getConnections(): ConnectionDescriptor[] {
    return Array.from(this.connections.values());
  }

  // --- Private helpers (voice management) ---

  private getAdsrParams(): { attack: number; decay: number; sustain: number; release: number } {
    for (const mod of this.modules.values()) {
      if (mod.typeId === 'adsr-envelope') {
        return {
          attack: (mod.parameters.attack as number) ?? 0.01,
          decay: (mod.parameters.decay as number) ?? 0.1,
          sustain: (mod.parameters.sustain as number) ?? 0.7,
          release: (mod.parameters.release as number) ?? 0.3,
        };
      }
    }
    return { attack: 0.005, decay: 0, sustain: 1, release: 0.02 };
  }

  /** Connect a voice gate to the same downstream targets as the original oscillator module. */
  private connectVoiceGate(oscModuleId: string, gate: GainNode): void {
    for (const conn of this.connections.values()) {
      if (conn.sourceModuleId !== oscModuleId) continue;
      const tgtMod = this.modules.get(conn.targetModuleId);
      if (!tgtMod) continue;
      const tgtNode = this.resolveInputNode(tgtMod, conn.targetPortId);
      if (tgtNode) {
        try { gate.connect(tgtNode); } catch { /* */ }
      }
    }
  }

  private cleanupVoice(vs: VoiceState): void {
    if (vs.cleanupTimer) clearTimeout(vs.cleanupTimer);
    for (const [, [osc, gate]] of vs.oscNodes) {
      try { osc.stop(); } catch { /* */ }
      try { osc.disconnect(); } catch { /* */ }
      try { gate.disconnect(); } catch { /* */ }
    }
    vs.oscNodes.clear();
  }

  // --- Private helpers (graph wiring) ---

  private findPort(
    moduleId: string,
    portId: string,
    expectedDirection: 'input' | 'output',
  ): PortDefinition {
    const mod = this.modules.get(moduleId);
    if (!mod) throw new PortNotFoundError(moduleId, portId);
    const port = mod.ports.find(
      (p) => p.id === portId && p.direction === expectedDirection,
    );
    if (!port) throw new PortNotFoundError(moduleId, portId);
    return port;
  }

  private connectAudio(conn: ConnectionDescriptor): void {
    if (!this.audioContext) return;
    const srcMod = this.modules.get(conn.sourceModuleId);
    const tgtMod = this.modules.get(conn.targetModuleId);
    if (!srcMod || !tgtMod) return;

    const srcNode = this.resolveOutputNode(srcMod);
    if (!srcNode) return;

    // Control → AudioParam connections (LFO/ADSR modulating a parameter)
    const param = this.resolveControlTarget(tgtMod, conn.targetPortId);
    if (param) {
      try { srcNode.connect(param); } catch (err) { console.warn('Control connect failed:', err); }
      return;
    }

    const tgtNode = this.resolveInputNode(tgtMod, conn.targetPortId);
    if (!tgtNode) return;

    try {
      srcNode.connect(tgtNode);
    } catch (err) {
      console.warn('Audio connect failed:', err);
    }
  }

  private disconnectAudio(conn: ConnectionDescriptor): void {
    if (!this.audioContext) return;
    const srcMod = this.modules.get(conn.sourceModuleId);
    const tgtMod = this.modules.get(conn.targetModuleId);
    if (!srcMod || !tgtMod) return;

    const srcNode = this.resolveOutputNode(srcMod);
    if (!srcNode) return;

    // Control → AudioParam disconnections
    const param = this.resolveControlTarget(tgtMod, conn.targetPortId);
    if (param) {
      try { srcNode.disconnect(param); } catch { /* not connected */ }
      return;
    }

    const tgtNode = this.resolveInputNode(tgtMod, conn.targetPortId);
    if (!tgtNode) return;

    try {
      srcNode.disconnect(tgtNode);
    } catch {
      // Not connected or already disconnected
    }
  }

  /**
   * Resolve which AudioNode is the audio output for a module.
   * Some modules have internal nodes (LFO, feedback) that aren't the audio output.
   */
  private resolveOutputNode(mod: ModuleInstance): AudioNode | null {
    // Chorus: [delay, lfo, lfoGain] — audio passes through delay (index 0)
    if (mod.typeId === 'chorus') return mod.audioNodes[0] ?? null;
    // Delay: [delay, feedbackGain] — audio output is the delay node (index 0)
    if (mod.typeId === 'delay') return mod.audioNodes[0] ?? null;
    // Mixer: [gain1, gain2, gain3, gain4, output] — output is the summing node (last)
    // Oscillator: [osc, gate] — gate is the output (last)
    // LFO: [osc, depthGain] — depthGain is the output (last)
    // Everything else: last node
    return getOutputNode(mod.audioNodes);
  }

  /**
   * Resolve which AudioNode corresponds to a specific input port.
   * For the mixer, each input port maps to a different gain node.
   * For all other modules, the first node is the input.
   */
  private resolveInputNode(mod: ModuleInstance, portId: string): AudioNode | null {
    if (mod.typeId === 'mixer') {
      const portMap: Record<string, number> = {
        'audio-in-1': 0, 'audio-in-2': 1, 'audio-in-3': 2, 'audio-in-4': 3,
      };
      const idx = portMap[portId];
      if (idx !== undefined && mod.audioNodes[idx]) return mod.audioNodes[idx];
    }
    return getInputNode(mod.audioNodes);
  }

  /**
   * Resolve a control input port to an AudioParam for modulation connections.
   * Returns null if the port is not a modulatable AudioParam target.
   */
  private resolveControlTarget(mod: ModuleInstance, portId: string): AudioParam | null {
    // Oscillator frequency-in → modulate osc.frequency
    if (mod.typeId === 'oscillator' && portId === 'frequency-in') {
      const osc = mod.audioNodes[0];
      if (osc instanceof OscillatorNode) return osc.frequency;
    }
    // Filter cutoff modulation (if a control-in port is added later)
    if (mod.typeId === 'filter' && portId === 'cutoff-in') {
      const filter = mod.audioNodes[0];
      if (filter instanceof BiquadFilterNode) return filter.frequency;
    }
    // Gain modulation
    if (mod.typeId === 'gain' && portId === 'gain-in') {
      const gain = mod.audioNodes[0];
      if (gain instanceof GainNode) return gain.gain;
    }
    // Panner modulation
    if (mod.typeId === 'panner' && portId === 'pan-in') {
      const panner = mod.audioNodes[0];
      if (panner instanceof StereoPannerNode) return panner.pan;
    }
    // Compressor threshold modulation
    if (mod.typeId === 'compressor' && portId === 'threshold-in') {
      const comp = mod.audioNodes[0];
      if (comp instanceof DynamicsCompressorNode) return comp.threshold;
    }
    // EQ 3-Band gain modulation (nodes: [low, mid, high])
    if (mod.typeId === 'eq3') {
      const bandMap: Record<string, number> = { 'lowGain-in': 0, 'midGain-in': 1, 'highGain-in': 2 };
      const idx = bandMap[portId];
      if (idx !== undefined) {
        const band = mod.audioNodes[idx];
        if (band instanceof BiquadFilterNode) return band.gain;
      }
    }
    return null;
  }

  private applyParameterToNodes(
    mod: ModuleInstance,
    paramId: string,
    value: number | string,
  ): void {
    const firstNode = mod.audioNodes[0];
    if (!firstNode) return;

    // --- Oscillator: [osc, gate] ---
    if (mod.typeId === 'oscillator') {
      const osc = firstNode as OscillatorNode;
      if (paramId === 'waveform') osc.type = value as OscillatorType;
      if (paramId === 'detune') osc.detune.value = value as number;
      return;
    }

    // --- Filter: single BiquadFilterNode ---
    if (mod.typeId === 'filter') {
      const filter = firstNode as BiquadFilterNode;
      if (paramId === 'filterType') filter.type = value as BiquadFilterType;
      if (paramId === 'cutoff') filter.frequency.value = value as number;
      if (paramId === 'resonance') filter.Q.value = value as number;
      return;
    }

    // --- ADSR Envelope: single GainNode (params stored, applied on trigger) ---
    if (mod.typeId === 'adsr-envelope') {
      return;
    }

    // --- LFO: [osc, depthGain] ---
    if (mod.typeId === 'lfo') {
      const osc = mod.audioNodes[0] as OscillatorNode;
      const depthGain = mod.audioNodes[1] as GainNode;
      if (paramId === 'waveform') osc.type = value as OscillatorType;
      if (paramId === 'rate') osc.frequency.value = value as number;
      if (paramId === 'depth' && depthGain) depthGain.gain.value = value as number;
      return;
    }

    // --- Delay: [delay, feedbackGain] ---
    if (mod.typeId === 'delay') {
      const delay = firstNode as DelayNode;
      if (paramId === 'time') delay.delayTime.value = value as number;
      if (paramId === 'feedback' && mod.audioNodes[1] instanceof GainNode) {
        (mod.audioNodes[1] as GainNode).gain.value = value as number;
      }
      return;
    }

    // --- Distortion: single WaveShaperNode ---
    if (mod.typeId === 'distortion') {
      const waveshaper = firstNode as WaveShaperNode;
      if (paramId === 'amount') {
        waveshaper.curve = makeDistortionCurve(value as number);
      }
      return;
    }

    // --- Chorus: [delay, lfo, lfoGain] ---
    if (mod.typeId === 'chorus') {
      const lfo = mod.audioNodes[1];
      const lfoGain = mod.audioNodes[2];
      if (paramId === 'rate' && lfo instanceof OscillatorNode) {
        lfo.frequency.value = value as number;
      }
      if (paramId === 'depth' && lfoGain instanceof GainNode) {
        lfoGain.gain.value = (value as number) * 0.01;
      }
      return;
    }

    // --- Reverb: single ConvolverNode ---
    if (mod.typeId === 'reverb') {
      if (paramId === 'decay' && this.audioContext) {
        const convolver = firstNode as ConvolverNode;
        const decayVal = value as number;
        convolver.buffer = createImpulseResponse(this.audioContext, decayVal, decayVal);
      }
      return;
    }

    // --- Mixer: [gain1, gain2, gain3, gain4, output] ---
    if (mod.typeId === 'mixer') {
      const gainMap: Record<string, number> = { gain1: 0, gain2: 1, gain3: 2, gain4: 3 };
      const idx = gainMap[paramId];
      if (idx !== undefined && mod.audioNodes[idx] instanceof GainNode) {
        (mod.audioNodes[idx] as GainNode).gain.value = value as number;
      }
      return;
    }

    // --- Gain / Output (Speaker): single GainNode ---
    if (mod.typeId === 'gain' || mod.typeId === 'output') {
      if (paramId === 'gain' && firstNode instanceof GainNode) {
        firstNode.gain.value = value as number;
      }
      return;
    }

    // --- Stereo Panner: single StereoPannerNode ---
    if (mod.typeId === 'panner') {
      if (paramId === 'pan' && firstNode instanceof StereoPannerNode) {
        firstNode.pan.value = value as number;
      }
      return;
    }

    // --- Compressor: single DynamicsCompressorNode ---
    if (mod.typeId === 'compressor') {
      const comp = firstNode as DynamicsCompressorNode;
      if (paramId === 'threshold') comp.threshold.value = value as number;
      if (paramId === 'ratio') comp.ratio.value = value as number;
      if (paramId === 'knee') comp.knee.value = value as number;
      if (paramId === 'attack') comp.attack.value = value as number;
      if (paramId === 'release') comp.release.value = value as number;
      return;
    }

    // --- EQ 3-Band: [lowBiquad, midBiquad, highBiquad] ---
    if (mod.typeId === 'eq3') {
      const [low, mid, high] = mod.audioNodes as BiquadFilterNode[];
      if (paramId === 'lowFreq' && low) low.frequency.value = value as number;
      if (paramId === 'lowGain' && low) low.gain.value = value as number;
      if (paramId === 'midFreq' && mid) mid.frequency.value = value as number;
      if (paramId === 'midGain' && mid) mid.gain.value = value as number;
      if (paramId === 'highFreq' && high) high.frequency.value = value as number;
      if (paramId === 'highGain' && high) high.gain.value = value as number;
      return;
    }
  }

}
