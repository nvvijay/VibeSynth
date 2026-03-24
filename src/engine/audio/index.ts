export { AudioGraph } from './AudioGraph';
export { ModuleRegistry } from './ModuleRegistry';
export { NoteManager } from './NoteManager';
export { VoiceAllocator } from './VoiceAllocator';
export type { Voice } from './VoiceAllocator';
export { registerBuiltInModules } from './modules';
export { makeDistortionCurve, createImpulseResponse, computeFilterMagnitude } from './dsp-utils.ts';
