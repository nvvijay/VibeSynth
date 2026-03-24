import type { ModuleDefinition } from '../../types';
import { DuplicateModuleError, InvalidModuleDefinitionError } from '../errors';

const REQUIRED_FIELDS = [
  'typeId',
  'name',
  'category',
  'parameters',
  'ports',
  'createAudioNode',
] as const;

export class ModuleRegistry {
  private modules = new Map<string, ModuleDefinition>();

  register(definition: ModuleDefinition): void {
    const missingFields = REQUIRED_FIELDS.filter(
      (field) => definition[field] == null,
    );

    if (missingFields.length > 0) {
      throw new InvalidModuleDefinitionError(missingFields);
    }

    if (this.modules.has(definition.typeId)) {
      throw new DuplicateModuleError(definition.typeId);
    }

    this.modules.set(definition.typeId, definition);
  }

  get(typeId: string): ModuleDefinition | undefined {
    return this.modules.get(typeId);
  }

  getAll(): ModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  getByCategory(category: string): ModuleDefinition[] {
    return this.getAll().filter((mod) => mod.category === category);
  }
}
