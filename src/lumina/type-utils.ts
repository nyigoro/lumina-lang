/**
 * Normalize type names for display in diagnostics and error messages.
 * Converts internal type representations to user-facing names.
 */
export function normalizeTypeNameForDisplay(typeName: string): string {
  const aliases: Record<string, string> = {
    int: 'i32',
    float: 'f64',
    usize: 'u32',
    unit: 'void',
  };

  return aliases[typeName] || typeName;
}

/**
 * Normalize a full type signature for display (and comparison).
 * Handles generic types by replacing aliases in-place.
 */
export function normalizeTypeForDisplay(type: string): string {
  return type
    .replace(/\bint\b/g, 'i32')
    .replace(/\bfloat\b/g, 'f64')
    .replace(/\busize\b/g, 'u32')
    .replace(/\bunit\b/g, 'void');
}

function splitTopLevelTypeArgs(input: string): string[] {
  const result: string[] = [];
  let angleDepth = 0;
  let parenDepth = 0;
  let braceDepth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '<') angleDepth += 1;
    if (ch === '>') angleDepth -= 1;
    if (ch === '(') parenDepth += 1;
    if (ch === ')') parenDepth -= 1;
    if (ch === '{') braceDepth += 1;
    if (ch === '}') braceDepth -= 1;
    if (ch === ',' && angleDepth === 0 && parenDepth === 0 && braceDepth === 0) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) {
    result.push(current.trim());
  }
  return result;
}

function canonicalizeFunctionType(type: string): string {
  const trimmed = type.trim();
  if (trimmed.startsWith('Fn<') && trimmed.endsWith('>')) {
    const inner = trimmed.slice(3, -1);
    const parts = splitTopLevelTypeArgs(inner).map((part) => normalizeTypeForComparison(part));
    return `Fn<${parts.join(',')}>`;
  }
  if (!trimmed.startsWith('fn(')) return trimmed;
  let depth = 0;
  let closeIdx = -1;
  for (let i = 2; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx < 0) return trimmed;
  const paramsText = trimmed.slice(3, closeIdx).trim();
  const tail = trimmed.slice(closeIdx + 1).trim();
  if (!tail.startsWith('->')) return trimmed;
  const returnType = tail.slice(2).trim();
  if (!returnType) return trimmed;
  const params = paramsText.length > 0 ? splitTopLevelTypeArgs(paramsText).map((part) => normalizeTypeForComparison(part)) : [];
  return `Fn<${[...params, normalizeTypeForComparison(returnType)].join(',')}>`;
}

/**
 * Normalize type strings for equality/comparison checks.
 */
export function normalizeTypeForComparison(type: string): string {
  return canonicalizeFunctionType(normalizeTypeForDisplay(type));
}
