import { describe, it, expect } from 'vitest';
import { ModuleRegistry } from '../../src/engine/audio/ModuleRegistry';
import {
  DuplicateModuleError,
  InvalidModuleDefinitionError,
} from '../../src/engine/errors';
import type { ModuleDefinition } from '../../src/types';

function makeDefinition(
  overrides: Partial<ModuleDefinition> = {},
): ModuleDefinition {
  return {
    typeId: 'test-osc',
    name: 'Test Oscillator',
    category: 'source',
    description: 'A test oscillator',
    parameters: [],
    ports: [{ id: 'out', name: 'Output', type: 'audio', direction: 'output' }],
    createAudioNode: () => new OscillatorNode(new AudioContext()),
    ...overrides,
  };
}

describe('ModuleRegistry', () => {
  it('registers and retrieves a module definition', () => {
    const registry = new ModuleRegistry();
    const def = makeDefinition();
    registry.register(def);

    const retrieved = registry.get('test-osc');
    expect(retrieved).toBe(def);
  });

  it('returns undefined for unknown typeId', () => {
    const registry = new ModuleRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('throws DuplicateModuleError on duplicate typeId', () => {
    const registry = new ModuleRegistry();
    registry.register(makeDefinition());

    expect(() => registry.register(makeDefinition())).toThrowError(
      DuplicateModuleError,
    );
  });

  it('throws InvalidModuleDefinitionError when required fields are missing', () => {
    const registry = new ModuleRegistry();
    const incomplete = { typeId: 'bad' } as unknown as ModuleDefinition;

    expect(() => registry.register(incomplete)).toThrowError(
      InvalidModuleDefinitionError,
    );
  });

  it('getAll returns all registered definitions', () => {
    const registry = new ModuleRegistry();
    const a = makeDefinition({ typeId: 'a', name: 'A' });
    const b = makeDefinition({ typeId: 'b', name: 'B', category: 'effect' });
    registry.register(a);
    registry.register(b);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(a);
    expect(all).toContain(b);
  });

  it('getByCategory returns correct subsets', () => {
    const registry = new ModuleRegistry();
    registry.register(makeDefinition({ typeId: 'osc', category: 'source' }));
    registry.register(
      makeDefinition({ typeId: 'flt', category: 'effect', name: 'Filter' }),
    );
    registry.register(
      makeDefinition({ typeId: 'gain', category: 'utility', name: 'Gain' }),
    );

    const sources = registry.getByCategory('source');
    expect(sources).toHaveLength(1);
    expect(sources[0].typeId).toBe('osc');

    const effects = registry.getByCategory('effect');
    expect(effects).toHaveLength(1);
    expect(effects[0].typeId).toBe('flt');

    expect(registry.getByCategory('modulator')).toHaveLength(0);
  });

  it('DuplicateModuleError preserves original definition', () => {
    const registry = new ModuleRegistry();
    const original = makeDefinition({ typeId: 'dup', name: 'Original' });
    registry.register(original);

    const duplicate = makeDefinition({ typeId: 'dup', name: 'Duplicate' });
    expect(() => registry.register(duplicate)).toThrow();

    expect(registry.get('dup')?.name).toBe('Original');
  });

  it('InvalidModuleDefinitionError lists missing fields', () => {
    const registry = new ModuleRegistry();
    const incomplete = {
      typeId: 'partial',
      name: 'Partial',
    } as unknown as ModuleDefinition;

    try {
      registry.register(incomplete);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidModuleDefinitionError);
      const msg = (e as Error).message;
      expect(msg).toContain('category');
      expect(msg).toContain('parameters');
      expect(msg).toContain('ports');
      expect(msg).toContain('createAudioNode');
    }
  });
});
