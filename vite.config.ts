import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

/**
 * The federation plugin injects `<link rel="modulepreload" href="<static remote entry>">` into index.html.
 * That hard-codes the build-time portal17 URL (defeating the runtime /config.json override, ADR 0002) and
 * logs a console error whenever the portal is down. Strip cross-origin remoteEntry preloads; the runtime
 * loads the remote entry on demand from the URL registered at boot.
 */
function stripRemoteEntryPreload(): Plugin {
  return {
    name: 'app19:strip-remote-entry-preload',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
          file.source = String(file.source).replace(
            /<link rel="modulepreload" crossorigin href="https?:\/\/[^"]+\/remoteEntry\.js">/g,
            '',
          );
        }
      },
    },
  };
}

// Static default for the portal17 remote (contract §2 / ADR 0002).
// Runtime override: /config.json -> registerRemotes(..., { force: true }) in src/mfe/remotes.ts.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const PORTAL17_ENTRY = env.VITE_REMOTE_PORTAL17 || 'http://localhost:5170/remoteEntry.js';

  return {
    plugins: [
      react(),
      federation({
        name: 'app19',
        filename: 'remoteEntry.js',
        exposes: {
          './DashboardPage': './src/exposed/DashboardPage.tsx',
          './CustomerFormPage': './src/exposed/CustomerFormPage.tsx',
          './StatsWidget': './src/exposed/StatsWidget.tsx',
        },
        remotes: {
          portal17: {
            type: 'module',
            name: 'portal17',
            entry: PORTAL17_ENTRY,
            entryGlobalName: 'portal17',
            shareScope: 'default',
          },
        },
        // Never share react/react-dom/jsx-runtime across React majors (ADR 0001).
        shared: {},
        // Nothing is shared, so the strategy only affects loading: the default 'version-first' fetches every
        // remote's remoteEntry.js eagerly at boot (before /config.json can override it). 'loaded-first' loads
        // a remote only on first loadRemote().
        shareStrategy: 'loaded-first',
        dts: false,
      }),
      stripRemoteEntryPreload(),
    ],
    server: {
      port: 5190,
      strictPort: true,
      origin: 'http://localhost:5190',
      watch: { ignored: ['**/infra/**'] },
    },
    preview: { port: 5190, strictPort: true },
    build: { target: 'es2022' },
  };
});
