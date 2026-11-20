// Runtime remote resolution (ADR 0002, contract §2).
// Imported from the same package (and version, 2.9.3) that @module-federation/vite
// bundles for its hostInit, so there is a single federation runtime instance per origin.
import { loadRemote, registerRemotes } from '@module-federation/runtime';
import type { RemoteModule } from './contract';

interface RuntimeConfig {
  remotes?: Record<string, string>;
}

/** Remote names this host knows about; only these are taken from config.json. */
const KNOWN_REMOTES = ['app19'] as const;

const DEFAULTS: Record<string, string> = {
  app19: __APP19_DEFAULT_ENTRY__,
};

export const resolvedRemotes: Record<string, string> = { ...DEFAULTS };

function isValidConfig(value: unknown): value is RuntimeConfig {
  if (!value || typeof value !== 'object') return false;
  const remotes = (value as RuntimeConfig).remotes;
  return !!remotes && typeof remotes === 'object';
}

async function readConfigOverrides(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-cache' });
    if (!res.ok) return {};
    const config: unknown = await res.json();
    if (!isValidConfig(config)) return {};
    const out: Record<string, string> = {};
    for (const name of KNOWN_REMOTES) {
      const entry = config.remotes?.[name];
      if (typeof entry === 'string' && entry.length > 0) out[name] = entry;
    }
    return out;
  } catch {
    return {}; // missing / invalid JSON → keep defaults
  }
}

/**
 * Fetch /config.json, then register every known remote under its plain name
 * (`app19`) with `force: true` — config.json URL if present, else the build-time default.
 *
 * Registration always happens: @module-federation/vite 1.24.1 registers its static
 * `remotes` under an internal alias (`__mfe_internal__portal17__mf_owner__…__app19`),
 * so `loadRemote('app19/…')` only resolves a remote registered here.
 * Call once at boot, before the first loadRemote (`force` resets remote caches).
 */
export async function applyRuntimeRemoteConfig(): Promise<void> {
  const overrides = await readConfigOverrides();
  for (const name of KNOWN_REMOTES) resolvedRemotes[name] = overrides[name] ?? DEFAULTS[name]!;

  registerRemotes(
    KNOWN_REMOTES.map((name) => ({
      name,
      entry: resolvedRemotes[name]!,
      type: 'module',
      entryGlobalName: name,
      shareScope: 'default',
    })),
    { force: true },
  );
}

const cache = new Map<string, Promise<RemoteModule<unknown>>>();

/** loadRemote once per remote id; a failed load is evicted so retry re-fetches. */
export function loadRemoteModule<P>(remote: string): Promise<RemoteModule<P>> {
  let p = cache.get(remote);
  if (!p) {
    p = loadRemote<RemoteModule<unknown>>(remote).then((mod) => {
      const mount = mod?.mount ?? mod?.default;
      if (typeof mount !== 'function') {
        throw new Error(`Remote "${remote}" did not export a mount function`);
      }
      return { ...mod, mount } as RemoteModule<unknown>;
    });
    p.catch(() => cache.delete(remote));
    cache.set(remote, p);
  }
  return p as Promise<RemoteModule<P>>;
}
