import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Library build (ADR 0004): the exposed mount adapters as a self-contained ESM package
 * `@mfe/app19-features`. React 19 + react-dom are bundled INSIDE (no externals, no peer dep), so a
 * React 17 host can import it at build time and still run these modules on their own React copy.
 * Run via `npm run build:lib` (scripts/build-lib.mjs), which also writes package.json and .d.ts files.
 */
export const LIB_ENTRIES = {
  DashboardPage: 'src/exposed/DashboardPage.tsx',
  CustomerFormPage: 'src/exposed/CustomerFormPage.tsx',
  StatsWidget: 'src/exposed/StatsWidget.tsx',
} as const;
export const LIB_OUT_DIR = 'lib-dist';

/** Inline all emitted CSS into every entry chunk; it adds one <style> to <head> on first import. */
function cssInjectedByJs(id: string): Plugin {
  return {
    name: 'mfe:css-injected-by-js',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      let css = '';
      for (const [file, out] of Object.entries(bundle)) {
        if (out.type === 'asset' && file.endsWith('.css')) {
          css += String(out.source);
          delete bundle[file];
        }
      }
      if (!css) return;
      const inject =
        `(()=>{if(typeof document==='undefined'||document.getElementById(${JSON.stringify(id)}))return;` +
        `const s=document.createElement('style');s.id=${JSON.stringify(id)};s.textContent=${JSON.stringify(css)};` +
        `document.head.appendChild(s);})();\n`;
      for (const out of Object.values(bundle)) {
        if (out.type === 'chunk' && out.isEntry) out.code = inject + out.code;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), cssInjectedByJs('mfe-app19-features-css')],
  // Bundled React must run its production build regardless of the consumer's bundler settings.
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  publicDir: false,
  build: {
    target: 'es2022',
    outDir: LIB_OUT_DIR,
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    minify: true,
    lib: {
      entry: Object.fromEntries(Object.entries(LIB_ENTRIES).map(([name, src]) => [`${name}/index`, src])),
      formats: ['es'],
    },
    rollupOptions: {
      external: [], // bundle everything, React included
      output: { chunkFileNames: 'chunks/[name]-[hash].js' },
    },
  },
});
