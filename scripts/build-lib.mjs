// npm run build:lib — builds packages/<name>/ (ESM + .d.ts + package.json) from vite.lib.config.ts.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'scripts/lib.json'), 'utf8'));
const out = join(root, cfg.outDir);
const bin = (n) => join(root, 'node_modules/.bin', n);
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });

rmSync(out, { recursive: true, force: true });
run(bin('vite'), ['build', '--config', 'vite.lib.config.ts']);

// contract.d.ts — the plain-data contract types every entry re-exports.
const tmp = join(root, 'node_modules/.tmp/lib-dts');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
writeFileSync(
  join(tmp, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      declaration: true, emitDeclarationOnly: true, skipLibCheck: true, strict: true,
      target: 'es2022', module: 'esnext', moduleResolution: 'bundler', lib: ['es2022', 'dom'],
      types: [], rootDir: join(root, 'src/mfe'), outDir: tmp,
    },
    files: [join(root, 'src/mfe/contract.ts')],
  }),
);
run(bin('tsc'), ['-p', join(tmp, 'tsconfig.json')]);
copyFileSync(join(tmp, 'contract.d.ts'), join(out, 'contract.d.ts'));

const pkgVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const exportsMap = {};
for (const [entry, propsType] of Object.entries(cfg.entries)) {
  mkdirSync(join(out, entry), { recursive: true });
  writeFileSync(
    join(out, entry, 'index.d.ts'),
    `import type { MountFn, ${propsType} } from '../contract';\n` +
      `export type * from '../contract';\n` +
      `export declare const mount: MountFn<${propsType}>;\n` +
      `export default mount;\n`,
  );
  exportsMap[`./${entry}`] = { types: `./${entry}/index.d.ts`, import: `./${entry}/index.js`, default: `./${entry}/index.js` };
}
writeFileSync(
  join(out, 'package.json'),
  JSON.stringify(
    {
      name: cfg.name,
      version: pkgVersion,
      description: cfg.description,
      type: 'module',
      sideEffects: true,
      exports: exportsMap,
      files: ['**/*.js', '**/*.d.ts'],
    },
    null,
    2,
  ) + '\n',
);
console.log(`built ${cfg.name}@${pkgVersion} -> ${cfg.outDir}`);
