import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

// Build-time default for the portal17 remoteEntry, used only in `"mode": "remote"` (ADR 0002/0004).
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
        // No static `remotes` (ADR 0004): the default "bundled" mode imports @mfe/portal17-features at build
        // time, and a static remote would make the plugin preload / eagerly fetch the portal's remoteEntry.js.
        // In "remote" mode src/mfe/remotes.ts registers portal17 at runtime from /config.json.
        // Never share react/react-dom/jsx-runtime across React majors (ADR 0001).
        shared: {},
        // Nothing is shared, so the strategy only affects loading: 'loaded-first' fetches a remote's
        // remoteEntry.js only on first loadRemote() (the default 'version-first' would fetch eagerly).
        shareStrategy: 'loaded-first',
        dts: false,
      }),
    ],
    define: { __PORTAL17_DEFAULT_ENTRY__: JSON.stringify(PORTAL17_ENTRY) },
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
