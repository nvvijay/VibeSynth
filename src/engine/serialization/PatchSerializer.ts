import type { PatchData } from '../../types';
import type { AudioGraph } from '../audio/AudioGraph';
import type { ModuleRegistry } from '../audio/ModuleRegistry';
import { PatchParseError, PatchValidationError } from '../errors';

const PATCH_VERSION = '1.0';

export class PatchSerializer {
  private registry: ModuleRegistry;

  constructor(registry: ModuleRegistry) {
    this.registry = registry;
  }

  serialize(
    graph: AudioGraph,
    settings: { masterVolume: number; polyphony: number },
  ): string {
    const modules = graph.getModules().map((m) => ({
      id: m.id,
      typeId: m.typeId,
      parameters: { ...m.parameters },
      position: { x: m.position.x, y: m.position.y },
    }));

    const connections = graph.getConnections().map((c) => ({
      id: c.id,
      sourceModuleId: c.sourceModuleId,
      sourcePortId: c.sourcePortId,
      targetModuleId: c.targetModuleId,
      targetPortId: c.targetPortId,
    }));

    const patch: PatchData = {
      version: PATCH_VERSION,
      modules,
      connections,
      masterVolume: settings.masterVolume,
      polyphony: settings.polyphony,
    };

    return JSON.stringify(patch);
  }

  deserialize(json: string): PatchData {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      throw new PatchParseError(
        e instanceof Error ? e.message : String(e),
      );
    }

    if (!this.validate(parsed)) {
      throw new PatchValidationError('Data does not conform to PatchData schema');
    }

    return parsed;
  }

  validate(data: unknown): data is PatchData {
    if (data == null || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // version must be a string
    if (typeof obj.version !== 'string') {
      return false;
    }

    // masterVolume must be a number
    if (typeof obj.masterVolume !== 'number') {
      return false;
    }

    // polyphony must be a number
    if (typeof obj.polyphony !== 'number') {
      return false;
    }

    // modules must be an array
    if (!Array.isArray(obj.modules)) {
      return false;
    }

    // connections must be an array
    if (!Array.isArray(obj.connections)) {
      return false;
    }

    // Validate each module entry
    const moduleIds = new Set<string>();
    for (const mod of obj.modules) {
      if (!this.isValidModule(mod)) {
        return false;
      }
      if (moduleIds.has(mod.id)) {
        return false; // duplicate module ID
      }
      moduleIds.add(mod.id);

      // All typeIds must be registered
      if (!this.registry.get(mod.typeId)) {
        return false;
      }
    }

    // Validate each connection entry
    const connectionIds = new Set<string>();
    for (const conn of obj.connections) {
      if (!this.isValidConnection(conn)) {
        return false;
      }
      if (connectionIds.has(conn.id)) {
        return false; // duplicate connection ID
      }
      connectionIds.add(conn.id);

      // All connection module references must exist in modules array
      if (!moduleIds.has(conn.sourceModuleId) || !moduleIds.has(conn.targetModuleId)) {
        return false;
      }
    }

    return true;
  }

  private isValidModule(mod: unknown): mod is PatchData['modules'][number] {
    if (mod == null || typeof mod !== 'object') {
      return false;
    }
    const m = mod as Record<string, unknown>;

    if (typeof m.id !== 'string') return false;
    if (typeof m.typeId !== 'string') return false;

    // parameters must be an object with string/number values
    if (m.parameters == null || typeof m.parameters !== 'object' || Array.isArray(m.parameters)) {
      return false;
    }
    for (const val of Object.values(m.parameters as Record<string, unknown>)) {
      if (typeof val !== 'number' && typeof val !== 'string') {
        return false;
      }
    }

    // position must have numeric x and y
    if (m.position == null || typeof m.position !== 'object' || Array.isArray(m.position)) {
      return false;
    }
    const pos = m.position as Record<string, unknown>;
    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      return false;
    }

    return true;
  }

  private isValidConnection(conn: unknown): conn is PatchData['connections'][number] {
    if (conn == null || typeof conn !== 'object') {
      return false;
    }
    const c = conn as Record<string, unknown>;

    return (
      typeof c.id === 'string' &&
      typeof c.sourceModuleId === 'string' &&
      typeof c.sourcePortId === 'string' &&
      typeof c.targetModuleId === 'string' &&
      typeof c.targetPortId === 'string'
    );
  }
}
