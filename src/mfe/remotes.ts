// Same package/specifier the @module-federation/vite plugin's generated host-init code imports,
// so this resolves to the single runtime instance the plugin initialised (no second copy).
import { getInstance, loadRemote, registerRemotes } from '@module-federation/runtime';
import type { RemoteModule } from './contract';

/** Remote names this app consumes. Static defaults live in vite.config.ts (env VITE_REMOTE_PORTAL17 → localhost). */
export const KNOWN_REMOTES = ['portal17'] as const;
type RemoteName = (typeof KNOWN_REMOTES)[number];

interface RuntimeConfig {
  remotes: Partial<Record<RemoteName, string>>;
}

type RegisteredRemote = Parameters<typeof registerRemotes>[0][number];

/**
 * The vite plugin registers static remotes under an internal name (`__mfe_internal__app19__…__portal17`)
 * with `alias: 'portal17'`, and loadRemote('portal17/X') resolves via that alias. Registering a new remote
 * named 'portal17' would sit *beside* it and never be used, so override the existing definition in place.
 */
function toRemote(name: RemoteName, entry: string): RegisteredRemote {
  const existing = getInstance()?.options.remotes.find((r) => r.name === name || r.alias === name);
  if (existing) return { ...existing, entry } as RegisteredRemote;
  return { name, entry, type: 'module', entryGlobalName: name, shareScope: 'default' };
}

function parseConfig(raw: unknown): RuntimeConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const remotes = (raw as { remotes?: unknown }).remotes;
  if (!remotes || typeof remotes !== 'object') return null;
  const out: RuntimeConfig = { remotes: {} };
  for (const name of KNOWN_REMOTES) {
    const url = (remotes as Record<string, unknown>)[name];
    if (typeof url === 'string' && /^https?:\/\//.test(url)) out.remotes[name] = url;
  }
  return out;
}

async function configure(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (!res.ok) return;
    const config = parseConfig(await res.json());
    if (!config) return;
    const entries = Object.entries(config.remotes) as [RemoteName, string][];
    if (entries.length === 0) return;
    registerRemotes(entries.map(([n, url]) => toRemote(n, url)), { force: true });
  } catch (err) {
    // Missing/invalid config.json → keep build-time defaults (ADR 0002).
    console.warn('[app19] /config.json not applied, using build-time remote defaults', err);
  }
}

let configured: Promise<void> | null = null;
/** Called once at boot (main.tsx); every load awaits it so the override lands before first load. */
export function initRemotes(): Promise<void> {
  configured ??= configure();
  return configured;
}

const cache = new Map<string, Promise<RemoteModule<unknown>>>();

/** loadRemote once per id (cached). Failed loads are evicted so a retry can try again. */
export function loadRemoteModule<P>(id: string, opts: { retry?: boolean } = {}): Promise<RemoteModule<P>> {
  if (opts.retry) {
    cache.delete(id);
    // The MF runtime caches a failed remote entry; re-register the current definition (force) to clear it.
    const name = id.split('/')[0];
    const current = getInstance()?.options.remotes.find((r) => r.name === name || r.alias === name);
    if (current) registerRemotes([current], { force: true });
  }
  let p = cache.get(id);
  if (!p) {
    p = initRemotes()
      .then(() => loadRemote<RemoteModule<unknown>>(id))
      .then((mod) => {
        const mount = mod?.mount ?? mod?.default;
        if (typeof mount !== 'function') throw new Error(`Remote "${id}" has no mount() export`);
        return { ...mod, mount };
      });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p as Promise<RemoteModule<P>>;
}
