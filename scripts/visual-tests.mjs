// Runs the screenshot comparisons in the official Playwright Linux image, so a
// developer machine and CI render the same pixels. Extra arguments are passed
// to Playwright, for example `npm run test:visual -- --update-snapshots`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit' });
  if (result.error) throw result.error;
  return result.status ?? 1;
};

// CI already runs inside the image and sets this variable.
if (process.env.TAKT_IN_PLAYWRIGHT_IMAGE) {
  process.exit(
    run('npm', [
      'run',
      'test:visual',
      '--workspace',
      '@takt/web',
      '--',
      ...args,
    ]),
  );
}

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const version = lock.packages['node_modules/@playwright/test'].version;
const image = `mcr.microsoft.com/playwright:v${version}-noble`;

// The checkout is copied instead of used in place: its node_modules belong to
// the host platform. Snapshots and failure output are copied back afterwards.
const inContainer = `
set -e
mkdir -p /work
cd /src
tar -c --exclude=./.git --exclude=node_modules --exclude=dist \
  --exclude=test-results --exclude=./.npm-cache \
  --exclude=./apps/desktop/src-tauri/target . | tar -x -C /work
cd /work
npm ci --no-audit --no-fund
npm run build --workspace @takt/web
status=0
npm run test:visual --workspace @takt/web -- "$@" || status=$?
cp -r apps/web/tests/visual/. /src/apps/web/tests/visual/
rm -rf /src/apps/web/test-results
if [ -d apps/web/test-results ]; then cp -r apps/web/test-results /src/apps/web/; fi
exit $status
`;

const status = run('docker', [
  'run',
  '--rm',
  '--init',
  '--ipc=host',
  '-v',
  `${process.cwd()}:/src`,
  '-v',
  'takt-npm-cache:/root/.npm',
  image,
  'sh',
  '-c',
  inContainer,
  'sh',
  ...args,
]);
if (status === 125 || status === 127)
  console.error(
    '\nThe visual tests need a running Docker engine; see README, "Visual tests".',
  );
process.exit(status);
