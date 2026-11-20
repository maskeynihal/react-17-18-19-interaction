// Feature loading (ADR 0004): portal17 features come from the bundled npm package by default ("bundled"),
// or via runtime Module Federation when /config.json says `"mode": "remote"` (ADR 0001/0002).
// The runtime is the same package/specifier the @module-federation/vite plugin's host-init code imports,
// so this resolves to the single runtime instance the plugin initialised (no second copy).
import { getInstance, init, loadRemote, registerRemotes } from '@module-federation/runtime';
import type { RemoteModule } from './contract';

/** Remote names this app consumes. Build-time default URL: __PORTAL17_DEFAULT_ENTRY__ (env VITE_REMOTE_PORTAL17). */
export const KNOWN_REMOTES = ['portal17'] as const;
type RemoteName = (typeof KNOWN_REMOTES)[number];

export type FeatureMode = 'bundled' | 'remote';

/**
 * Bundled mode: each id maps to a dynamic import of `@mfe/portal17-features/<Expose>` (vendor/*.tgz,
 * React 17 bundled inside). Dynamic so each feature is its own code-split chunk, fetched from our own origin.
 */
const BUNDLED: Record<string, () => Promise<unknown>> = {
  'portal17/UsersPage': () => import('@mfe/portal17-features/UsersPage'),
  'portal17/ProfileCard': () => import('@mfe/portal17-features/ProfileCard'),
};

const DEFAULT_ENTRIES: Record<RemoteName, string> = { portal17: __PORTAL17_DEFAULT_ENTRY__ };

interface RuntimeConfig {
  mode: FeatureMode;
  remotes: Partial<Record<RemoteName, string>>;
}

type RegisteredRemote = Parameters<typeof registerRemotes>[0][number];

/** Missing/invalid config → bundled mode (the app must run standalone). */
function parseConfig(raw: unknown): RuntimeConfig {
  const out: RuntimeConfig = { mode: 'bundled', remotes: {} };
  if (!raw || typeof raw !== 'object') return out;
  if ((raw as { mode?: unknown }).mode === 'remote') out.mode = 'remote';
  const remotes = (raw as { remotes?: unknown }).remotes;
  if (remotes && typeof remotes === 'object') {
    for (const name of KNOWN_REMOTES) {
      const url = (remotes as Record<string, unknown>)[name];
      if (typeof url === 'string' && /^https?:\/\//.test(url)) out.remotes[name] = url;
    }
  }
  return out;
}

function toRemote(name: RemoteName, entry: string): RegisteredRemote {
  return { name, entry, type: 'module', entryGlobalName: name, shareScope: 'default' };
}

/** Remote mode only: register every known remote (config.json URL, else build-time default). */
function registerRuntimeRemotes(config: RuntimeConfig): void {
  const remotes = KNOWN_REMOTES.map((n) => toRemote(n, config.remotes[n] ?? DEFAULT_ENTRIES[n]));
  if (getInstance()) registerRemotes(remotes, { force: true });
  else init({ name: 'app19', remotes });
}

async function configure(): Promise<FeatureMode> {
  let config = parseConfig(null);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (res.ok) config = parseConfig(await res.json());
  } catch (err) {
    console.warn('[app19] /config.json not applied, using bundled features', err);
  }
  if (config.mode === 'remote') registerRuntimeRemotes(config);
  return config.mode;
}

let configured: Promise<FeatureMode> | null = null;
/** Called once at boot (main.tsx); every load awaits it so the mode (and remote URLs) are settled first. */
export function initRemotes(): Promise<FeatureMode> {
  configured ??= configure();
  return configured;
}

const cache = new Map<string, Promise<RemoteModule<unknown>>>();

async function loadRaw(id: string, retry: boolean): Promise<Partial<RemoteModule<unknown>> | undefined> {
  const mode = await initRemotes();
  if (mode === 'bundled') {
    const load = BUNDLED[id];
    if (!load) throw new Error(`No bundled feature for "${id}"`);
    return (await load()) as Partial<RemoteModule<unknown>>;
  }
  if (retry) {
    // The MF runtime caches a failed remote entry; re-register the current definition (force) to clear it.
    const name = id.split('/')[0];
    const current = getInstance()?.options.remotes.find((r) => r.name === name || r.alias === name);
    if (current) registerRemotes([current], { force: true });
  }
  return (await loadRemote<RemoteModule<unknown>>(id)) ?? undefined;
}

/** Load a feature's mount adapter once per id (cached). Failed loads are evicted so a retry can try again. */
export function loadRemoteModule<P>(id: string, opts: { retry?: boolean } = {}): Promise<RemoteModule<P>> {
  if (opts.retry) cache.delete(id);
  let p = cache.get(id);
  if (!p) {
    p = loadRaw(id, !!opts.retry).then((mod) => {
      const mount = mod?.mount ?? mod?.default;
      if (typeof mount !== 'function') throw new Error(`Feature "${id}" has no mount() export`);
      return { ...mod, mount };
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p as Promise<RemoteModule<P>>;
}
