// Feature loading (ADR 0004, contract §2): app19 features come from the bundled npm package by default
// ("bundled"), or via runtime Module Federation when /config.json says `"mode": "remote"` (ADR 0001/0002).
// The runtime is imported from the same package (and version, 2.9.3) that @module-federation/vite
// bundles for its hostInit, so there is a single federation runtime instance per origin.
import { getInstance, init, loadRemote, registerRemotes } from '@module-federation/runtime';
import type { RemoteModule } from './contract';

export type FeatureMode = 'bundled' | 'remote';

interface RuntimeConfig {
  mode?: unknown;
  remotes?: Record<string, unknown>;
}

/** Remote names this host knows about; only these are taken from config.json. */
const KNOWN_REMOTES = ['app19'] as const;

const DEFAULTS: Record<string, string> = {
  app19: __APP19_DEFAULT_ENTRY__,
};

/**
 * Bundled mode: each id maps to a dynamic import of `@mfe/app19-features/<Expose>` (vendor/*.tgz,
 * React 19 bundled inside). Dynamic so each feature is its own code-split chunk, served from our own origin.
 */
const BUNDLED: Record<string, () => Promise<unknown>> = {
  'app19/DashboardPage': () => import('@mfe/app19-features/DashboardPage'),
  'app19/CustomerFormPage': () => import('@mfe/app19-features/CustomerFormPage'),
  'app19/StatsWidget': () => import('@mfe/app19-features/StatsWidget'),
};

export const resolvedRemotes: Record<string, string> = { ...DEFAULTS };
let mode: FeatureMode = 'bundled';

/** Feature mode resolved at boot ('bundled' unless config.json says "remote"). */
export function featureMode(): FeatureMode {
  return mode;
}

async function readConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    const config: unknown = await res.json();
    return config && typeof config === 'object' ? (config as RuntimeConfig) : {};
  } catch {
    return {}; // missing / invalid JSON → bundled mode
  }
}

/**
 * Fetch /config.json and settle the feature mode. Missing/invalid config → "bundled" (standalone).
 * Only in "remote" mode: register every known remote under its plain name (`app19`) with `force: true` —
 * config.json URL if present, else the build-time default.
 * Call once at boot, before the first load.
 */
export async function applyRuntimeRemoteConfig(): Promise<FeatureMode> {
  const config = await readConfig();
  mode = config.mode === 'remote' ? 'remote' : 'bundled';
  if (mode === 'bundled') return mode;

  for (const name of KNOWN_REMOTES) {
    const entry = config.remotes && typeof config.remotes === 'object' ? config.remotes[name] : undefined;
    resolvedRemotes[name] = typeof entry === 'string' && entry.length > 0 ? entry : DEFAULTS[name]!;
  }
  const remotes = KNOWN_REMOTES.map((name) => ({
    name,
    entry: resolvedRemotes[name]!,
    type: 'module',
    entryGlobalName: name,
    shareScope: 'default',
  }));
  if (getInstance()) registerRemotes(remotes, { force: true });
  else init({ name: 'portal17', remotes });
  return mode;
}

const cache = new Map<string, Promise<RemoteModule<unknown>>>();

function loadRaw(id: string): Promise<Partial<RemoteModule<unknown>> | null | undefined> {
  if (mode === 'remote') return loadRemote<RemoteModule<unknown>>(id);
  const load = BUNDLED[id];
  if (!load) return Promise.reject(new Error(`No bundled feature for "${id}"`));
  return load() as Promise<Partial<RemoteModule<unknown>>>;
}

/** Load a feature's mount adapter once per id; a failed load is evicted so retry re-fetches. */
export function loadRemoteModule<P>(remote: string): Promise<RemoteModule<P>> {
  let p = cache.get(remote);
  if (!p) {
    p = loadRaw(remote).then((mod) => {
      const mount = mod?.mount ?? mod?.default;
      if (typeof mount !== 'function') {
        throw new Error(`Feature "${remote}" did not export a mount function`);
      }
      return { ...mod, mount } as RemoteModule<unknown>;
    });
    p.catch(() => cache.delete(remote));
    cache.set(remote, p);
  }
  return p as Promise<RemoteModule<P>>;
}
