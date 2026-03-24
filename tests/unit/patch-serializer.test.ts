import { describe, it, expect, beforeEach } from 'vitest';
import { PatchSerializer } from '../../src/engine/serialization/PatchSerializer';
import { ModuleRegistry } from '../../src/engine/audio/ModuleRegistry';
import { AudioGraph } from '../../src/engine/audio/AudioGraph';
import { PatchParseError, PatchValidationError } from '../../src/engine/errors';
import type { ModuleDefinition } from '../../src/types';

function makeDefinition(typeId: string): ModuleDefinition {
  return {
    typeId,
    name: typeId,
    category: 'source',
    description: `${typeId} module`,
    parameters: [
      { id: 'freq', name: 'Frequency', type: 'number', min: 20, max: 20000, defaultValue: 440 },
    ],
    ports: [
      { id: 'audio-out', name: 'Audio Out', type: 'audio', direction: 'output' },
      { id: 'audio-in', name: 'Audio In', type: 'audio', direction: 'input' },
    ],
    createAudioNode: () => (null as unknown as AudioNode),
  };
}

describe('PatchSerializer', () => {
  let registry: ModuleRegistry;
  let serializer: PatchSerializer;

  beforeEach(() => {
    registry = new ModuleRegistry();
    registry.register(makeDefinition('oscillator'));
    registry.register(makeDefinition('filter'));
    serializer = new PatchSerializer(registry);
  });

  describe('serialize()', () => {
    it('produces valid JSON from graph state', () => {
      const graph = new AudioGraph(registry);
      graph.addModule('oscillator', { x: 10, y: 20 });

      const json = serializer.serialize(graph, { masterVolume: 0.7, polyphony: 4 });
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('1.0');
      expect(parsed.masterVolume).toBe(0.7);
      expect(parsed.polyphony).toBe(4);
      expect(parsed.modules).toHaveLength(1);
      expect(parsed.modules[0].typeId).toBe('oscillator');
      expect(parsed.modules[0].position).toEqual({ x: 10, y: 20 });
      expect(parsed.connections).toHaveLength(0);
    });

    it('includes connections in serialized output', () => {
      const graph = new AudioGraph(registry);
      const m1 = graph.addModule('oscillator', { x: 0, y: 0 });
      const m2 = graph.addModule('filter', { x: 100, y: 0 });
      graph.connect(m1.id, 'audio-out', m2.id, 'audio-in');

      const json = serializer.serialize(graph, { masterVolume: 0.5, polyphony: 2 });
      const parsed = JSON.parse(json);

      expect(parsed.connections).toHaveLength(1);
      expect(parsed.connections[0].sourceModuleId).toBe(m1.id);
      expect(parsed.connections[0].targetModuleId).toBe(m2.id);
    });
  });

  describe('deserialize()', () => {
    it('returns PatchData for valid JSON', () => {
      const graph = new AudioGraph(registry);
      graph.addModule('oscillator', { x: 50, y: 60 });
      const json = serializer.serialize(graph, { masterVolume: 0.8, polyphony: 3 });

      const patch = serializer.deserialize(json);

      expect(patch.version).toBe('1.0');
      expect(patch.modules).toHaveLength(1);
      expect(patch.masterVolume).toBe(0.8);
      expect(patch.polyphony).toBe(3);
    });

    it('throws PatchParseError on invalid JSON', () => {
      expect(() => serializer.deserialize('not json')).toThrow(PatchParseError);
    });

    it('throws PatchValidationError on valid JSON with wrong schema', () => {
      expect(() => serializer.deserialize('{"foo": "bar"}')).toThrow(PatchValidationError);
    });
  });

  describe('validate()', () => {
    it('returns true for valid PatchData', () => {
      const data = {
        version: '1.0',
        modules: [
          { id: 'mod-1', typeId: 'oscillator', parameters: { freq: 440 }, position: { x: 0, y: 0 } },
        ],
        connections: [],
        masterVolume: 0.5,
        polyphony: 2,
      };
      expect(serializer.validate(data)).toBe(true);
    });

    it('rejects null', () => {
      expect(serializer.validate(null)).toBe(false);
    });

    it('rejects missing version', () => {
      expect(serializer.validate({ modules: [], connections: [], masterVolume: 0.5, polyphony: 2 })).toBe(false);
    });

    it('rejects non-number masterVolume', () => {
      expect(serializer.validate({ version: '1.0', modules: [], connections: [], masterVolume: 'loud', polyphony: 2 })).toBe(false);
    });

    it('rejects non-number polyphony', () => {
      expect(serializer.validate({ version: '1.0', modules: [], connections: [], masterVolume: 0.5, polyphony: 'two' })).toBe(false);
    });

    it('rejects duplicate module IDs', () => {
      const data = {
        version: '1.0',
        modules: [
          { id: 'mod-1', typeId: 'oscillator', parameters: {}, position: { x: 0, y: 0 } },
          { id: 'mod-1', typeId: 'filter', parameters: {}, position: { x: 1, y: 1 } },
        ],
        connections: [],
        masterVolume: 0.5,
        polyphony: 2,
      };
      expect(serializer.validate(data)).toBe(false);
    });

    it('rejects duplicate connection IDs', () => {
      const data = {
        version: '1.0',
        modules: [
          { id: 'mod-1', typeId: 'oscillator', parameters: {}, position: { x: 0, y: 0 } },
          { id: 'mod-2', typeId: 'filter', parameters: {}, position: { x: 1, y: 1 } },
        ],
        connections: [
          { id: 'c-1', sourceModuleId: 'mod-1', sourcePortId: 'out', targetModuleId: 'mod-2', targetPortId: 'in' },
          { id: 'c-1', sourceModuleId: 'mod-2', sourcePortId: 'out', targetModuleId: 'mod-1', targetPortId: 'in' },
        ],
        masterVolume: 0.5,
        polyphony: 2,
      };
      expect(serializer.validate(data)).toBe(false);
    });

    it('rejects unregistered typeIds', () => {
      const data = {
        version: '1.0',
        modules: [
          { id: 'mod-1', typeId: 'unknown-module', parameters: {}, position: { x: 0, y: 0 } },
        ],
        connections: [],
        masterVolume: 0.5,
        polyphony: 2,
      };
      expect(serializer.validate(data)).toBe(false);
    });

    it('rejects connections referencing non-existent modules', () => {
      const data = {
        version: '1.0',
        modules: [
          { id: 'mod-1', typeId: 'oscillator', parameters: {}, position: { x: 0, y: 0 } },
        ],
        connections: [
          { id: 'c-1', sourceModuleId: 'mod-1', sourcePortId: 'out', targetModuleId: 'mod-999', targetPortId: 'in' },
        ],
        masterVolume: 0.5,
        polyphony: 2,
      };
      expect(serializer.validate(data)).toBe(false);
    });

    it('rejects module with invalid position', () => {
      const data = {
        version: '1.0',
        modules: [
          { id: 'mod-1', typeId: 'oscillator', parameters: {}, position: { x: 'bad', y: 0 } },
        ],
        connections: [],
        masterVolume: 0.5,
        polyphony: 2,
      };
      expect(serializer.validate(data)).toBe(false);
    });
  });
});
