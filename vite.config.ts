import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

// Static default for app19's remoteEntry. Overridden at runtime by /config.json (ADR 0002).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const APP19_ENTRY = env.VITE_REMOTE_APP19 || 'http://localhost:5190/remoteEntry.js';

  return {
    plugins: [
      react(),
      federation({
        name: 'portal17',
        filename: 'remoteEntry.js',
        exposes: {
          './UsersPage': './src/exposed/UsersPage.tsx',
          './ProfileCard': './src/exposed/ProfileCard.tsx',
        },
        remotes: {
          app19: {
            type: 'module',
            name: 'app19',
            entry: APP19_ENTRY,
            entryGlobalName: 'app19',
            shareScope: 'default',
          },
        },
        // Contract §2: never share react / react-dom / jsx-runtime across majors.
        shared: {},
        shareStrategy: 'loaded-first',
        dts: false,
      }),
    ],
    define: {
      __APP19_DEFAULT_ENTRY__: JSON.stringify(APP19_ENTRY),
    },
    // infra/ is owned by the CDK project (may contain cdk.out copies of dist/index.html).
    optimizeDeps: { entries: ['index.html'] },
    server: {
      port: 5170,
      strictPort: true,
      origin: 'http://localhost:5170',
      watch: { ignored: ['**/infra/**', '**/test-results/**', '**/playwright-report/**'] },
    },
    preview: { port: 5170, strictPort: true },
    build: { target: 'es2022' },
  };
});
