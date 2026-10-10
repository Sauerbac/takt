import { spawn } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { chromium, expect } from '@playwright/test';
const directory = await mkdtemp(join(tmpdir(), 'takt-launch-'));
const report = join(directory, 'report.json');
const executable = resolve('apps/desktop/src-tauri/target/release/takt.exe');
const copiedExecutable = join(directory, 'takt.exe');
const projectPath = join(directory, 'roundtrip.takt');
const frontend = resolve('apps/web/dist');
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, 'http://localhost').pathname,
    );
    const file = resolve(
      frontend,
      '.' + (pathname === '/' ? '/index.html' : pathname),
    );
    if (!file.startsWith(frontend + '\\')) {
      response.writeHead(403).end();
      return;
    }
    const data = await readFile(file);
    const mime = file.endsWith('.html')
      ? 'text/html'
      : file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': mime }).end(data);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolveReady) =>
  server.listen(0, '127.0.0.1', resolveReady),
);
const browser = await chromium.launch();
try {
  await copyFile(executable, copiedExecutable);
  const page = await browser.newPage();
  const address = `http://127.0.0.1:${server.address().port}`;
  await page.goto(address);
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: 'Open .takt file', exact: true })
    .click();
  await (
    await chooser
  ).setFiles(resolve('apps/web/src/project/fixtures/mixed.takt'));
  await expect(page.getByLabel('Project title')).toHaveValue('Autumn α 🌻');
  const downloading = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  await (await downloading).saveAs(projectPath);
  const exported = JSON.parse(await readFile(projectPath, 'utf8'));
  const child = spawn(copiedExecutable, ['--integration-test-report', report], {
    cwd: directory,
    windowsHide: true,
    stdio: 'inherit',
  });
  const exit = await new Promise((resolveExit, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Desktop integration timed out after 45 seconds'));
    }, 45_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      resolveExit(code);
    });
  });
  const result = JSON.parse(await readFile(report, 'utf8'));
  if (exit !== 0 || !result.ok)
    throw new Error(`Desktop integration failed: ${JSON.stringify(result)}`);
  const native = JSON.parse(await readFile(projectPath, 'utf8'));
  expect(native.title).toBe('Native round trip');
  expect(native.document).toEqual(exported.document);
  expect(native.view).toEqual(exported.view);
  await page.reload();
  const reopening = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: 'Open .takt file', exact: true })
    .click();
  await (await reopening).setFiles(projectPath);
  await expect(page.getByLabel('Project title')).toHaveValue(
    'Native round trip',
  );
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  const redownload = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const redownloaded = JSON.parse(
    await readFile(await (await redownload).path(), 'utf8'),
  );
  expect(redownloaded.document).toEqual(native.document);
  expect(redownloaded.view.zoom).toBe(native.view.zoom);
  expect(redownloaded.view.collapsedSectionIds).toEqual(
    native.view.collapsedSectionIds,
  );
  result.webExportToNative = true;
  result.nativeSaveToWebOpen = true;
  console.log(`Direct EXE integration passed: ${JSON.stringify(result)}`);
} finally {
  await browser.close();
  await new Promise((resolveClosed) => server.close(resolveClosed));
  await rm(directory, { recursive: true, force: true });
}
