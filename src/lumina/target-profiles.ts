import type { ModuleExport } from './module-registry.js';

export type AnalyzeTarget = 'cjs' | 'esm' | 'wasm' | 'js' | 'wasm-web' | 'wasm-standalone';
export type LuminaTargetProfile = 'js' | 'wasm-web' | 'wasm-standalone';
export type LuminaCapability = 'core' | 'web' | 'reactive' | 'render' | 'wasi';
export type LuminaHostCapability =
  | 'web.dom'
  | 'web.storage'
  | 'web.history'
  | 'web.worker'
  | 'web.streams'
  | 'web.fetch'
  | 'web.gpu'
  | 'wasi.fs'
  | 'wasi.io'
  | 'wasi.env'
  | 'wasi.process';

export interface CapabilityMetadata {
  capabilities: LuminaCapability[];
  hostCapabilities: LuminaHostCapability[];
}

export interface TargetProfileDefinition {
  name: LuminaTargetProfile;
  allowedCapabilities: LuminaCapability[];
  hostCapabilities: LuminaHostCapability[];
}

const capabilityMetadata = (
  capabilities: LuminaCapability[],
  hostCapabilities: LuminaHostCapability[] = []
): CapabilityMetadata => ({
  capabilities,
  hostCapabilities,
});

export const TARGET_PROFILES: Record<LuminaTargetProfile, TargetProfileDefinition> = {
  js: {
    name: 'js',
    allowedCapabilities: ['core', 'web', 'reactive', 'render', 'wasi'],
    hostCapabilities: [
      'web.dom',
      'web.storage',
      'web.history',
      'web.worker',
      'web.streams',
      'web.fetch',
      'web.gpu',
      'wasi.fs',
      'wasi.io',
      'wasi.env',
      'wasi.process',
    ],
  },
  'wasm-web': {
    name: 'wasm-web',
    allowedCapabilities: ['core', 'web', 'reactive', 'render'],
    hostCapabilities: [
      'web.dom',
      'web.storage',
      'web.history',
      'web.worker',
      'web.streams',
      'web.fetch',
    ],
  },
  'wasm-standalone': {
    name: 'wasm-standalone',
    allowedCapabilities: ['core', 'wasi'],
    hostCapabilities: ['wasi.fs', 'wasi.io', 'wasi.env', 'wasi.process'],
  },
};

export function normalizeTargetProfile(target?: AnalyzeTarget): LuminaTargetProfile {
  if (!target || target === 'cjs' || target === 'esm' || target === 'js') return 'js';
  if (target === 'wasm-standalone') return 'wasm-standalone';
  return 'wasm-web';
}

export function isAnalyzeTarget(value: string | undefined): value is AnalyzeTarget {
  return (
    value === 'cjs' ||
    value === 'esm' ||
    value === 'wasm' ||
    value === 'js' ||
    value === 'wasm-web' ||
    value === 'wasm-standalone'
  );
}

const exportNameOf = (binding: ModuleExport): string => {
  if (binding.kind === 'function' || binding.kind === 'overloaded-function' || binding.kind === 'value') {
    return binding.exportName ?? binding.name;
  }
  return binding.name;
};

const capabilityMetadataForModuleId = (
  moduleId: string,
  exportName?: string
): CapabilityMetadata => {
  switch (moduleId) {
    case 'std://reactive':
      return capabilityMetadata(['reactive']);
    case 'std://render':
      return capabilityMetadata(['web', 'reactive', 'render'], ['web.dom']);
    case 'std://dom':
      return capabilityMetadata(['web'], ['web.dom']);
    case 'std://router-runtime':
      return capabilityMetadata(['web'], ['web.history']);
    case 'std://web_storage':
      return capabilityMetadata(['web'], ['web.storage']);
    case 'std://web_worker':
      return capabilityMetadata(['web'], ['web.worker']);
    case 'std://web_streams':
      return capabilityMetadata(['web'], ['web.streams']);
    case 'std://webgpu':
      return capabilityMetadata(['web'], ['web.gpu']);
    case 'std://http':
      return capabilityMetadata(['web'], ['web.fetch']);
    case 'std://opfs':
      return capabilityMetadata(['web'], ['web.storage']);
    case 'std://sab_channel':
      return capabilityMetadata(['web'], ['web.worker']);
    case 'std://fs':
      return capabilityMetadata(['wasi'], ['wasi.fs']);
    case 'std://env':
      return capabilityMetadata(['wasi'], ['wasi.env']);
    case 'std://process':
      return capabilityMetadata(['wasi'], ['wasi.process']);
    case 'std://path':
      return capabilityMetadata(['wasi']);
    case 'std://io':
      switch (exportName) {
        case 'read_file':
          return capabilityMetadata(['wasi'], ['wasi.fs']);
        case 'println':
        case 'print':
        case 'eprint':
        case 'eprintln':
        case 'readLine':
        case 'readLineAsync':
          return capabilityMetadata(['wasi'], ['wasi.io']);
        default:
          return capabilityMetadata(['core']);
      }
    default:
      return capabilityMetadata(['core']);
  }
};

export function getCapabilityMetadataForExport(
  binding: ModuleExport | undefined,
  member?: string
): CapabilityMetadata {
  if (!binding) return capabilityMetadata(['core']);
  if (binding.kind === 'module') {
    if (member) {
      const nested = binding.exports.get(member);
      if (nested) return getCapabilityMetadataForExport(nested);
    }
    return capabilityMetadataForModuleId(binding.moduleId);
  }
  return capabilityMetadataForModuleId(binding.moduleId, member ?? exportNameOf(binding));
}
