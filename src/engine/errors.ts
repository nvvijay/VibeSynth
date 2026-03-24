export class DuplicateModuleError extends Error {
  constructor(typeId: string) {
    super(`Module with typeId "${typeId}" is already registered.`);
    this.name = 'DuplicateModuleError';
  }
}

export class InvalidModuleDefinitionError extends Error {
  constructor(missingFields: string[]) {
    super(
      `Invalid module definition: missing required fields: ${missingFields.join(', ')}`,
    );
    this.name = 'InvalidModuleDefinitionError';
  }
}

export class UnknownModuleTypeError extends Error {
  constructor(typeId: string) {
    super(`Unknown module type: "${typeId}" is not registered.`);
    this.name = 'UnknownModuleTypeError';
  }
}

export class IncompatiblePortError extends Error {
  constructor(sourcePortType: string, targetPortType: string) {
    super(
      `Incompatible port types: cannot connect "${sourcePortType}" output to "${targetPortType}" input.`,
    );
    this.name = 'IncompatiblePortError';
  }
}

export class PortNotFoundError extends Error {
  constructor(moduleId: string, portId: string) {
    super(`Port "${portId}" not found on module "${moduleId}".`);
    this.name = 'PortNotFoundError';
  }
}

export class PatchParseError extends Error {
  constructor(message: string) {
    super(`Failed to parse patch JSON: ${message}`);
    this.name = 'PatchParseError';
  }
}

export class PatchValidationError extends Error {
  constructor(message: string) {
    super(`Patch validation failed: ${message}`);
    this.name = 'PatchValidationError';
  }
}
