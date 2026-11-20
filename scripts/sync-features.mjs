// npm run sync:features — rebuild + pack the sibling repo's feature package (ADR 0004), vendor it, install it.
// Sibling checkout: $SIBLING_DIR (legacy alias $APP19_DIR), default ../react19-app.
// Later: publish to a private registry instead and depend on a version range — no code change needed.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_NAME = '@mfe/app19-features';
const SIBLING_DEFAULT = '../react19-app';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sibling = resolve(root, process.env.SIBLING_DIR ?? process.env.APP19_DIR ?? SIBLING_DEFAULT);
if (!existsSync(join(sibling, 'package.json'))) throw new Error(`SIBLING_DIR: no package.json in ${sibling}`);
const npm = (args, cwd) => execFileSync('npm', args, { cwd, stdio: 'inherit' });

console.log(`> npm run pack:lib in ${sibling}`);
npm(['run', 'pack:lib'], sibling);

const version = JSON.parse(readFileSync(join(sibling, 'lib-dist/package.json'), 'utf8')).version;
const tgz = `${PKG_NAME.replace('@', '').replace('/', '-')}-${version}.tgz`;
const src = join(sibling, 'lib-pack', tgz);
if (!existsSync(src)) throw new Error(`expected tarball ${src}`);

const vendor = join(root, 'vendor');
mkdirSync(vendor, { recursive: true });
const prefix = tgz.slice(0, tgz.lastIndexOf('-') + 1);
for (const f of readdirSync(vendor)) if (f.startsWith(prefix) && f.endsWith('.tgz')) rmSync(join(vendor, f));
copyFileSync(src, join(vendor, tgz));

// Same version + new bytes: drop the installed copy so npm re-extracts and the lockfile integrity is rewritten.
rmSync(join(root, 'node_modules', ...PKG_NAME.split('/')), { recursive: true, force: true });
rmSync(join(root, 'node_modules/.vite'), { recursive: true, force: true });
npm(['install', `${PKG_NAME}@file:vendor/${tgz}`], root);
console.log(`> ${PKG_NAME}@${version} vendored as vendor/${tgz} and installed`);
