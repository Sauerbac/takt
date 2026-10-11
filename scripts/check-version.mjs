// Fails unless every manifest carries the same version. With an argument such
// as `v0.1.0`, that release tag must match too.
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path)).version;
const cargo = (path, pattern) => read(path).match(pattern)?.[1];

const versions = {
  'package.json': json('package.json'),
  'apps/web/package.json': json('apps/web/package.json'),
  'apps/desktop/package.json': json('apps/desktop/package.json'),
  'apps/desktop/src-tauri/tauri.conf.json': json(
    'apps/desktop/src-tauri/tauri.conf.json',
  ),
  'apps/desktop/src-tauri/Cargo.toml': cargo(
    'apps/desktop/src-tauri/Cargo.toml',
    /^version = "(.+)"$/m,
  ),
  'apps/desktop/src-tauri/Cargo.lock': cargo(
    'apps/desktop/src-tauri/Cargo.lock',
    /name = "takt"\r?\nversion = "(.+)"/,
  ),
};
const tag = process.argv[2];
if (tag) versions[`tag ${tag}`] = tag.replace(/^v/, '');

if (new Set(Object.values(versions)).size !== 1) {
  console.error('Versions disagree:');
  for (const [source, version] of Object.entries(versions))
    console.error(`  ${version ?? 'missing'}  ${source}`);
  process.exit(1);
}
console.log(`Version ${Object.values(versions)[0]}`);
