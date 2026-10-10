import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { draw, chooseZoom, laneGeometry } from '../helpers';

test('production exports real bytes and reopens title, mixed content and view with fresh history', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, -1, 2, 'Research');
  await page.getByLabel('Project title').fill('Launch plan');
  const downloaded = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const file = await downloaded;
  const bytes = await readFile((await file.path())!);
  const project = JSON.parse(bytes.toString());
  expect(project.title).toBe('Launch plan');
  expect(project.document.bars[0]).toMatchObject({
    start: -1,
    end: 2,
    name: 'Research',
  });
  expect(project.view.zoom).toBe(1);
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Control+n');
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  await (
    await chooser
  ).setFiles({
    name: file.suggestedFilename(),
    mimeType: 'application/json',
    buffer: bytes,
  });
  await expect(page.getByLabel('Project title')).toHaveValue('Launch plan');
  await expect(page.locator('.bar')).toHaveAttribute('data-start', '-1');
  await expect(page.locator('.bar')).toHaveAttribute('data-end', '2');
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test('mixed imported data preserves all content and effective native scroll through actual exported bytes', async ({
  page,
}) => {
  const mixed = JSON.parse(
    await readFile(
      new URL('../../src/project/fixtures/mixed.takt', import.meta.url),
      'utf8',
    ),
  );
  for (let index = 0; index < 24; index++)
    mixed.document.rows.push({
      id: `imported-row-${index}`,
      sectionId: '__proto__',
      name: `Work ${index}`,
    });
  mixed.document.bars[0].id = '00000000-0000-4000-8000-000000000001';
  await page.setViewportSize({ width: 900, height: 650 });
  await page.goto('/');
  const importing = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open .takt file' }).click();
  await (
    await importing
  ).setFiles({
    name: 'mixed.takt',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(mixed)),
  });
  await expect(page.getByLabel('Project title')).toHaveValue(mixed.title);
  await expect(
    page.getByRole('button', { name: 'Expand Unnamed section', exact: true }),
  ).toBeVisible();
  await chooseZoom(page, '0.75');
  await page.locator('.viewport').evaluate((node) => {
    node.scrollLeft = 123;
    node.scrollTop = 220;
  });
  await expect
    .poll(() => page.locator('.viewport').evaluate((node) => node.scrollLeft))
    .toBe(123);
  const viewBefore = await page
    .getByTestId('lane')
    .first()
    .evaluate((node) => ({
      firstWeek: Number((node as HTMLElement).dataset.firstWeek),
      weekWidth: Number((node as HTMLElement).dataset.weekWidth),
    }));
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  await page.getByLabel('Project title').fill('Mixed edited plan');
  const downloading = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const download = await downloading;
  const bytes = await readFile((await download.path())!);
  const exported = JSON.parse(bytes.toString());
  expect(exported.document).toEqual(mixed.document);
  expect(exported.title).toBe('Mixed edited plan');
  expect(exported.view.zoom).toBe(0.75);
  expect(exported.view.scrollTop).toBe(220);
  expect(exported.view.collapsedSectionIds).toEqual(['constructor']);
  expect(exported.view.firstWeek).toBeCloseTo(
    viewBefore.firstWeek + 123 / viewBefore.weekWidth,
    6,
  );
  await page.keyboard.press('Control+n');
  const opening = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  await (
    await opening
  ).setFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/json',
    buffer: bytes,
  });
  await expect(page.getByLabel('Project title')).toHaveValue(
    'Mixed edited plan',
  );
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await expect
    .poll(() => page.locator('.viewport').evaluate((node) => node.scrollTop))
    .toBe(220);
  const reopened = await page
    .getByTestId('lane')
    .first()
    .getAttribute('data-first-week');
  expect(Number(reopened)).toBeCloseTo(exported.view.firstWeek, 6);
  // Imported UUID-shaped IDs remain distinct from subsequently created objects.
  await page.locator('.viewport').evaluate((node) => (node.scrollTop = 0));
  const lane = await laneGeometry(page, 1);
  const newStart = Math.ceil(exported.view.firstWeek) + 3;
  await page.mouse.move(lane.x(newStart), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(newStart + 2), lane.y, { steps: 5 });
  await page.mouse.up();
  await page.getByRole('textbox', { name: 'Bar name' }).fill('New work');
  await page.getByRole('textbox', { name: 'Bar name' }).press('Enter');
  const again = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const final = JSON.parse(
    await readFile((await (await again).path())!, 'utf8'),
  );
  const ids = [
    ...final.document.sections,
    ...final.document.rows,
    ...final.document.bars,
    ...final.document.milestones,
  ].map((item) => item.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(final.document.bars).toHaveLength(3);
});
