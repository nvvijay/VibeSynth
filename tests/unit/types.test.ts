import { describe, it, expect } from 'vitest';
import type {
  PortDefinition,
  ParameterDefinition,
  ModuleDefinition,
  ConnectionDescriptor,
  NoteEvent,
  PatchData,
  ViewportState,
} from '../../src/types';

describe('Core type definitions', () => {
  it('PortDefinition supports audio and control types', () => {
    const port: PortDefinition = {
      id: 'audio-out',
      name: 'Audio Output',
      type: 'audio',
      direction: 'output',
    };
    expect(port.type).toBe('audio');
    expect(port.direction).toBe('output');
  });

  it('ParameterDefinition supports number type with range', () => {
    const param: ParameterDefinition = {
      id: 'cutoff',
      name: 'Cutoff Frequency',
      type: 'number',
      min: 20,
      max: 20000,
      defaultValue: 1000,
    };
    expect(param.min).toBe(20);
    expect(param.max).toBe(20000);
    expect(param.defaultValue).toBe(1000);
  });

  it('ParameterDefinition supports enum type', () => {
    const param: ParameterDefinition = {
      id: 'waveform',
      name: 'Waveform',
      type: 'enum',
      defaultValue: 'sine',
      enumValues: ['sine', 'square', 'sawtooth', 'triangle'],
    };
    expect(param.enumValues).toContain('sine');
    expect(param.defaultValue).toBe('sine');
  });

  it('NoteEvent represents note-on and note-off', () => {
    const noteOn: NoteEvent = {
      type: 'note-on',
      noteNumber: 60,
      velocity: 100,
      source: 'keyboard',
    };
    expect(noteOn.type).toBe('note-on');
    expect(noteOn.noteNumber).toBe(60);

    const noteOff: NoteEvent = {
      type: 'note-off',
      noteNumber: 60,
      velocity: 0,
      source: 'midi',
    };
    expect(noteOff.type).toBe('note-off');
  });

  it('ConnectionDescriptor links source and target modules', () => {
    const conn: ConnectionDescriptor = {
      id: 'conn-1',
      sourceModuleId: 'mod-1',
      sourcePortId: 'audio-out',
      targetModuleId: 'mod-2',
      targetPortId: 'audio-in',
    };
    expect(conn.sourceModuleId).toBe('mod-1');
    expect(conn.targetModuleId).toBe('mod-2');
  });

  it('PatchData contains modules, connections, and settings', () => {
    const patch: PatchData = {
      version: '1.0',
      modules: [
        {
          id: 'mod-1',
          typeId: 'oscillator',
          parameters: { waveform: 'sawtooth', detune: 0 },
          position: { x: 100, y: 200 },
        },
      ],
      connections: [],
      masterVolume: 0.7,
      polyphony: 4,
    };
    expect(patch.version).toBe('1.0');
    expect(patch.modules).toHaveLength(1);
    expect(patch.masterVolume).toBe(0.7);
  });

  it('ViewportState tracks pan and zoom', () => {
    const viewport: ViewportState = {
      panX: 0,
      panY: 0,
      zoom: 1.0,
    };
    expect(viewport.zoom).toBe(1.0);
  });
});
