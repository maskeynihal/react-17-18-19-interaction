/**
 * Context helpers.
 *
 * Values passed on the CLI (`cdk synth -c key=value`) always arrive as strings,
 * while values from cdk.json / cdk.context.json arrive as parsed JSON. These
 * helpers accept both forms.
 */

export function contextString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

export function contextBool(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  throw new Error(`Expected a boolean context value, got "${String(value)}"`);
}

function parseMaybeJson(value: unknown, name: string): unknown {
  if (typeof value !== 'string') return value;
  const s = value.trim();
  if (s === '') return undefined;
  if (s.startsWith('[') || s.startsWith('{')) {
    try {
      return JSON.parse(s);
    } catch (e) {
      throw new Error(`Context "${name}" is not valid JSON: ${(e as Error).message}`);
    }
  }
  return s;
}

/** Accepts a JSON array, an array, or a comma-separated string. */
export function contextStringList(value: unknown, name: string): string[] | undefined {
  const v = parseMaybeJson(value, name);
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
  throw new Error(`Context "${name}" must be a list of strings`);
}

/** Accepts a JSON object string or an object of string values. */
export function contextStringMap(value: unknown, name: string): Record<string, string> | undefined {
  const v = parseMaybeJson(value, name);
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) {
    throw new Error(`Context "${name}" must be a JSON object, e.g. {"app19":"https://dxxx.cloudfront.net/remoteEntry.js"}`);
  }
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val !== 'string') throw new Error(`Context "${name}.${k}" must be a string URL`);
    out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}
