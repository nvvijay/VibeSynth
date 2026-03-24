import type { ModuleDefinition } from '../../types';
import type { ModuleRegistry } from './ModuleRegistry';
import { createImpulseResponse, makeDistortionCurve } from './dsp-utils.ts';

// --- 5.1 Oscillator ---
const oscillatorModule: ModuleDefinition = {
  typeId: 'oscillator',
  name: 'Oscillator',
  category: 'source',
  description: 'Generates periodic waveforms (sine, square, sawtooth, triangle)',
  parameters: [
    {
      id: 'waveform',
      name: 'Waveform',
      type: 'enum',
      defaultValue: 'sine',
      enumValues: ['sine', 'square', 'sawtooth', 'triangle'],
    },
    {
      id: 'detune',
      name: 'Detune',
      type: 'number',
      min: -100,
      max: 100,
      defaultValue: 0,
    },
  ],
  ports: [
    { id: 'frequency-in', name: 'Frequency In', type: 'control', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const osc = context.createOscillator();
    osc.type = (params.waveform as OscillatorType) || 'sine';
    osc.detune.value = (params.detune as number) || 0;
    osc.start();

    // Gate gain: silent until a note is pressed
    const gate = context.createGain();
    gate.gain.value = 0;
    osc.connect(gate);

    return [osc, gate];
  },
};

// --- 5.2 Filter ---
const filterModule: ModuleDefinition = {
  typeId: 'filter',
  name: 'Filter',
  category: 'effect',
  description: 'Attenuates frequencies using low-pass, high-pass, band-pass, or notch filtering',
  parameters: [
    {
      id: 'filterType',
      name: 'Filter Type',
      type: 'enum',
      defaultValue: 'lowpass',
      enumValues: ['lowpass', 'highpass', 'bandpass', 'notch'],
    },
    {
      id: 'cutoff',
      name: 'Cutoff',
      type: 'number',
      min: 20,
      max: 20000,
      defaultValue: 1000,
    },
    {
      id: 'resonance',
      name: 'Resonance',
      type: 'number',
      min: 0.1,
      max: 30,
      defaultValue: 1,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'cutoff-in', name: 'Cutoff CV', type: 'control', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const filter = context.createBiquadFilter();
    filter.type = (params.filterType as BiquadFilterType) || 'lowpass';
    filter.frequency.value = (params.cutoff as number) || 1000;
    filter.Q.value = (params.resonance as number) || 1;
    return filter;
  },
};

// --- 5.3 ADSR Envelope ---
const adsrEnvelopeModule: ModuleDefinition = {
  typeId: 'adsr-envelope',
  name: 'ADSR Envelope',
  category: 'modulator',
  description: 'Shapes amplitude over time using Attack, Decay, Sustain, and Release parameters',
  parameters: [
    {
      id: 'attack',
      name: 'Attack',
      type: 'number',
      min: 0.001,
      max: 5,
      defaultValue: 0.01,
    },
    {
      id: 'decay',
      name: 'Decay',
      type: 'number',
      min: 0.001,
      max: 5,
      defaultValue: 0.1,
    },
    {
      id: 'sustain',
      name: 'Sustain',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.7,
    },
    {
      id: 'release',
      name: 'Release',
      type: 'number',
      min: 0.001,
      max: 10,
      defaultValue: 0.3,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
    { id: 'trigger-in', name: 'Trigger In', type: 'control', direction: 'input' },
    { id: 'control-out', name: 'Control Out', type: 'control', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext) => {
    const gain = context.createGain();
    gain.gain.value = 0;
    return gain;
  },
};

// --- 5.4 LFO ---
const lfoModule: ModuleDefinition = {
  typeId: 'lfo',
  name: 'LFO',
  category: 'modulator',
  description: 'Low-frequency oscillator for modulating parameters of other modules',
  parameters: [
    {
      id: 'waveform',
      name: 'Waveform',
      type: 'enum',
      defaultValue: 'sine',
      enumValues: ['sine', 'square', 'sawtooth', 'triangle'],
    },
    {
      id: 'rate',
      name: 'Rate',
      type: 'number',
      min: 0.01,
      max: 20,
      defaultValue: 1,
    },
    {
      id: 'depth',
      name: 'Depth',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.5,
    },
  ],
  ports: [
    { id: 'control-out', name: 'Control Out', type: 'control', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const osc = context.createOscillator();
    osc.type = (params.waveform as OscillatorType) || 'sine';
    osc.frequency.value = (params.rate as number) || 1;
    osc.start();

    const depthGain = context.createGain();
    depthGain.gain.value = (params.depth as number) ?? 0.5;

    osc.connect(depthGain);

    return [osc, depthGain];
  },
};

// --- 5.5 Effects ---

// Reverb
const reverbModule: ModuleDefinition = {
  typeId: 'reverb',
  name: 'Reverb',
  category: 'effect',
  description: 'Adds spatial reverberation to the audio signal',
  parameters: [
    {
      id: 'dryWet',
      name: 'Dry/Wet',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.3,
    },
    {
      id: 'decay',
      name: 'Decay',
      type: 'number',
      min: 0.1,
      max: 10,
      defaultValue: 2,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const convolver = context.createConvolver();
    const decayVal = (params.decay as number) || 2;
    convolver.buffer = createImpulseResponse(context, decayVal, decayVal);
    return convolver;
  },
};

// Delay
const delayModule: ModuleDefinition = {
  typeId: 'delay',
  name: 'Delay',
  category: 'effect',
  description: 'Adds echo/delay effect to the audio signal',
  parameters: [
    {
      id: 'dryWet',
      name: 'Dry/Wet',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.3,
    },
    {
      id: 'time',
      name: 'Time',
      type: 'number',
      min: 0.01,
      max: 2,
      defaultValue: 0.3,
    },
    {
      id: 'feedback',
      name: 'Feedback',
      type: 'number',
      min: 0,
      max: 0.95,
      defaultValue: 0.4,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const delay = context.createDelay(2);
    delay.delayTime.value = (params.time as number) || 0.3;

    const feedbackGain = context.createGain();
    feedbackGain.gain.value = (params.feedback as number) || 0.4;

    delay.connect(feedbackGain);
    feedbackGain.connect(delay);

    return [delay, feedbackGain];
  },
};

// Distortion
const distortionModule: ModuleDefinition = {
  typeId: 'distortion',
  name: 'Distortion',
  category: 'effect',
  description: 'Adds harmonic distortion to the audio signal',
  parameters: [
    {
      id: 'dryWet',
      name: 'Dry/Wet',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.5,
    },
    {
      id: 'amount',
      name: 'Amount',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 20,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const waveshaper = context.createWaveShaper();
    const amount = (params.amount as number) || 20;
    waveshaper.curve = makeDistortionCurve(amount);
    waveshaper.oversample = '4x';
    return waveshaper;
  },
};

// Chorus
const chorusModule: ModuleDefinition = {
  typeId: 'chorus',
  name: 'Chorus',
  category: 'effect',
  description: 'Adds chorus modulation effect to the audio signal',
  parameters: [
    {
      id: 'dryWet',
      name: 'Dry/Wet',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.5,
    },
    {
      id: 'rate',
      name: 'Rate',
      type: 'number',
      min: 0.1,
      max: 10,
      defaultValue: 1.5,
    },
    {
      id: 'depth',
      name: 'Depth',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.5,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const delay = context.createDelay(0.05);
    delay.delayTime.value = 0.025;

    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = (params.rate as number) || 1.5;

    const lfoGain = context.createGain();
    lfoGain.gain.value = ((params.depth as number) ?? 0.5) * 0.01;

    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    lfo.start();

    return [delay, lfo, lfoGain];
  },
};

// --- 5.6 Mixer and Gain ---

// Mixer
const mixerModule: ModuleDefinition = {
  typeId: 'mixer',
  name: 'Mixer',
  category: 'utility',
  description: 'Combines multiple audio signals into one output with individual gain controls',
  parameters: [
    {
      id: 'gain1',
      name: 'Gain 1',
      type: 'number',
      min: 0,
      max: 2,
      defaultValue: 1,
    },
    {
      id: 'gain2',
      name: 'Gain 2',
      type: 'number',
      min: 0,
      max: 2,
      defaultValue: 1,
    },
    {
      id: 'gain3',
      name: 'Gain 3',
      type: 'number',
      min: 0,
      max: 2,
      defaultValue: 1,
    },
    {
      id: 'gain4',
      name: 'Gain 4',
      type: 'number',
      min: 0,
      max: 2,
      defaultValue: 1,
    },
  ],
  ports: [
    { id: 'audio-in-1', name: 'Audio In 1', type: 'audio', direction: 'input' },
    { id: 'audio-in-2', name: 'Audio In 2', type: 'audio', direction: 'input' },
    { id: 'audio-in-3', name: 'Audio In 3', type: 'audio', direction: 'input' },
    { id: 'audio-in-4', name: 'Audio In 4', type: 'audio', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const gain1 = context.createGain();
    gain1.gain.value = (params.gain1 as number) ?? 1;

    const gain2 = context.createGain();
    gain2.gain.value = (params.gain2 as number) ?? 1;

    const gain3 = context.createGain();
    gain3.gain.value = (params.gain3 as number) ?? 1;

    const gain4 = context.createGain();
    gain4.gain.value = (params.gain4 as number) ?? 1;

    const output = context.createGain();
    output.gain.value = 1;

    gain1.connect(output);
    gain2.connect(output);
    gain3.connect(output);
    gain4.connect(output);

    return [gain1, gain2, gain3, gain4, output];
  },
};

// Gain
const gainModule: ModuleDefinition = {
  typeId: 'gain',
  name: 'Gain',
  category: 'utility',
  description: 'Adjusts the amplitude of an audio signal',
  parameters: [
    {
      id: 'gain',
      name: 'Gain',
      type: 'number',
      min: 0,
      max: 2,
      defaultValue: 1,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'gain-in', name: 'Gain CV', type: 'control', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const gain = context.createGain();
    gain.gain.value = (params.gain as number) ?? 1;
    return gain;
  },
};

// --- Output (Speaker) ---
const outputModule: ModuleDefinition = {
  typeId: 'output',
  name: 'Speaker',
  category: 'utility',
  description: 'Routes audio to the master output (speakers/headphones)',
  parameters: [
    {
      id: 'gain',
      name: 'Volume',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 1,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const gain = context.createGain();
    gain.gain.value = (params.gain as number) ?? 1;
    // This gain node will be connected to master by AudioGraph.addModule
    return gain;
  },
};

// --- Stereo Panner ---
const stereoPannerModule: ModuleDefinition = {
  typeId: 'panner',
  name: 'Stereo Panner',
  category: 'utility',
  description: 'Positions audio in the stereo field from left to right',
  parameters: [
    {
      id: 'pan',
      name: 'Pan',
      type: 'number',
      min: -1,
      max: 1,
      defaultValue: 0,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'pan-in', name: 'Pan CV', type: 'control', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const panner = context.createStereoPanner();
    panner.pan.value = (params.pan as number) ?? 0;
    return panner;
  },
};

// --- Compressor ---
const compressorModule: ModuleDefinition = {
  typeId: 'compressor',
  name: 'Compressor',
  category: 'effect',
  description: 'Reduces dynamic range by attenuating loud signals',
  parameters: [
    {
      id: 'threshold',
      name: 'Threshold',
      type: 'number',
      min: -100,
      max: 0,
      defaultValue: -24,
    },
    {
      id: 'ratio',
      name: 'Ratio',
      type: 'number',
      min: 1,
      max: 20,
      defaultValue: 12,
    },
    {
      id: 'knee',
      name: 'Knee',
      type: 'number',
      min: 0,
      max: 40,
      defaultValue: 30,
    },
    {
      id: 'attack',
      name: 'Attack',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.003,
    },
    {
      id: 'release',
      name: 'Release',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.25,
    },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'threshold-in', name: 'Threshold CV', type: 'control', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const comp = context.createDynamicsCompressor();
    comp.threshold.value = (params.threshold as number) ?? -24;
    comp.ratio.value = (params.ratio as number) ?? 12;
    comp.knee.value = (params.knee as number) ?? 30;
    comp.attack.value = (params.attack as number) ?? 0.003;
    comp.release.value = (params.release as number) ?? 0.25;
    return comp;
  },
};

// --- EQ 3-Band ---
const eq3Module: ModuleDefinition = {
  typeId: 'eq3',
  name: 'EQ 3-Band',
  category: 'effect',
  description: 'Three-band parametric equalizer with adjustable frequency and gain per band',
  parameters: [
    { id: 'lowFreq', name: 'Low Freq', type: 'number', min: 20, max: 2000, defaultValue: 200 },
    { id: 'lowGain', name: 'Low Gain', type: 'number', min: -12, max: 12, defaultValue: 0 },
    { id: 'midFreq', name: 'Mid Freq', type: 'number', min: 200, max: 8000, defaultValue: 1000 },
    { id: 'midGain', name: 'Mid Gain', type: 'number', min: -12, max: 12, defaultValue: 0 },
    { id: 'highFreq', name: 'High Freq', type: 'number', min: 2000, max: 20000, defaultValue: 8000 },
    { id: 'highGain', name: 'High Gain', type: 'number', min: -12, max: 12, defaultValue: 0 },
  ],
  ports: [
    { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    { id: 'lowGain-in', name: 'Low Gain CV', type: 'control', direction: 'input' },
    { id: 'midGain-in', name: 'Mid Gain CV', type: 'control', direction: 'input' },
    { id: 'highGain-in', name: 'High Gain CV', type: 'control', direction: 'input' },
    { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  createAudioNode: (context: AudioContext, params: Record<string, number | string>) => {
    const low = context.createBiquadFilter();
    low.type = 'peaking';
    low.frequency.value = (params.lowFreq as number) ?? 200;
    low.gain.value = (params.lowGain as number) ?? 0;
    low.Q.value = 1;

    const mid = context.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = (params.midFreq as number) ?? 1000;
    mid.gain.value = (params.midGain as number) ?? 0;
    mid.Q.value = 1;

    const high = context.createBiquadFilter();
    high.type = 'peaking';
    high.frequency.value = (params.highFreq as number) ?? 8000;
    high.gain.value = (params.highGain as number) ?? 0;
    high.Q.value = 1;

    low.connect(mid);
    mid.connect(high);

    return [low, mid, high];
  },
};

// --- Registration function ---

export function registerBuiltInModules(registry: ModuleRegistry): void {
  registry.register(oscillatorModule);
  registry.register(filterModule);
  registry.register(adsrEnvelopeModule);
  registry.register(lfoModule);
  registry.register(reverbModule);
  registry.register(delayModule);
  registry.register(distortionModule);
  registry.register(chorusModule);
  registry.register(mixerModule);
  registry.register(gainModule);
  registry.register(outputModule);
  registry.register(stereoPannerModule);
  registry.register(compressorModule);
  registry.register(eq3Module);
}

export default registerBuiltInModules;
