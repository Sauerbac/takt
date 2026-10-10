import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { fileDrag } from '../project-drop-helpers';

test('production drops mixed file bytes on Home, exports them, and drops the saved copy into the editor', async ({
  page,
}) => {
  const bytes = await readFile(
    new URL('../../src/project/fixtures/mixed.takt', import.meta.url),
    'utf8',
  );
  const mixed = JSON.parse(bytes);
  await page.goto('/');
  await fileDrag(page, 'drop', [{ name: 'mixed.takt', bytes }], '.drop-zone');
  await expect(page.getByLabel('Project title')).toHaveValue(mixed.title);
  await page.getByLabel('Project title').fill('Dropped round trip');
  await page.getByLabel('Project title').press('Enter');
  const downloading = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const exported = await readFile((await (await downloading).path())!, 'utf8');
  expect(JSON.parse(exported).document).toEqual(mixed.document);
  await page.keyboard.press('Control+n');
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await fileDrag(page, 'drop', [{ name: 'saved.takt', bytes: exported }]);
  await expect(page.getByLabel('Project title')).toHaveValue(
    'Dropped round trip',
  );
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
});
