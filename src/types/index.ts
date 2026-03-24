// Shared type definitions for the Modular Audio Synthesizer
// Derived from the design document's Components, Interfaces, and Data Models sections.

// --- Port & Parameter Definitions ---

export interface PortDefinition {
  id: string;
  name: string;
  type: "audio" | "control";
  direction: "input" | "output";
}

export interface ParameterDefinition {
  id: string;
  name: string;
  type: "number" | "enum";
  min?: number;
  max?: number;
  defaultValue: number | string;
  enumValues?: string[];
}

// --- Module Definition & Registry ---

export interface ModuleDefinition {
  typeId: string;
  name: string;
  category: "source" | "effect" | "modulator" | "utility";
  description: string;
  parameters: ParameterDefinition[];
  ports: PortDefinition[];
  createAudioNode: (
    context: AudioContext,
    params: Record<string, number | string>
  ) => AudioNode | AudioNode[];
}

// --- Module Instance (runtime state) ---

export interface ModuleInstance {
  id: string;
  typeId: string;
  audioNodes: AudioNode[];
  parameters: Record<string, number | string>;
  ports: PortDefinition[];
  position: { x: number; y: number };
}

// --- Connection ---

export interface ConnectionDescriptor {
  id: string;
  sourceModuleId: string;
  sourcePortId: string;
  targetModuleId: string;
  targetPortId: string;
}

// --- Note Event ---

export interface NoteEvent {
  type: "note-on" | "note-off";
  noteNumber: number; // MIDI note number 0-127
  velocity: number;   // 0-127
  source: "keyboard" | "midi" | "sequencer";
}

// --- Sequencer Types ---

export type TransportState = 'stopped' | 'recording' | 'playing';

export type ArpPattern = 'up' | 'down' | 'up-down' | 'random';

export interface NoteEventRecord {
  type: 'note-on' | 'note-off';
  noteNumber: number;   // 0-127
  velocity: number;     // 0-127
  timestamp: number;    // ms relative to sequence start
}

export interface SequencerCallbacks {
  onNoteOn: (noteNumber: number, velocity: number) => void;
  onNoteOff: (noteNumber: number) => void;
  onStateChange: (state: TransportState) => void;
  onPositionChange: (positionMs: number) => void;
}

export interface LatchCallbacks {
  onNoteOn: (noteNumber: number, velocity: number) => void;
  onNoteOff: (noteNumber: number) => void;
}

export interface ArpeggiatorCallbacks {
  onNoteOn: (noteNumber: number, velocity: number) => void;
  onNoteOff: (noteNumber: number) => void;
}

// --- Patch Data (serialization schema) ---

export interface PatchData {
  version: string;
  modules: Array<{
    id: string;
    typeId: string;
    parameters: Record<string, number | string>;
    position: { x: number; y: number };
  }>;
  connections: Array<{
    id: string;
    sourceModuleId: string;
    sourcePortId: string;
    targetModuleId: string;
    targetPortId: string;
  }>;
  masterVolume: number;
  polyphony: number;
}

// --- Viewport State (graph editor) ---

export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number; // 0.25 to 4.0
}
