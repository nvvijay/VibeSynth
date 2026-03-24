/**
 * Shared DSP utility functions used across the audio engine and visualizations.
 */

/** Generate a waveshaper distortion curve for the given amount. */
export function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 44100;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const k = amount;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/** Generate a stereo impulse response buffer for convolution reverb. */
export function createImpulseResponse(
  context: AudioContext,
  duration: number,
  decay: number,
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = context.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

/** Compute approximate filter magnitude response at a given frequency. */
export function computeFilterMagnitude(
  type: string,
  cutoff: number,
  Q: number,
  freq: number,
): number {
  const ratio = freq / cutoff;
  const r2 = ratio * ratio;
  const q = Math.max(Q, 0.5);
  switch (type) {
    case 'lowpass':
      return 1 / Math.sqrt((1 - r2) ** 2 + (ratio / q) ** 2);
    case 'highpass':
      return r2 / Math.sqrt((1 - r2) ** 2 + (ratio / q) ** 2);
    case 'bandpass':
      return (ratio / q) / Math.sqrt((1 - r2) ** 2 + (ratio / q) ** 2);
    case 'notch':
      return Math.sqrt((1 - r2) ** 2) / Math.sqrt((1 - r2) ** 2 + (ratio / q) ** 2);
    default:
      return 1;
  }
}
