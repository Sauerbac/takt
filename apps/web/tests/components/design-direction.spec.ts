import { test, expect, type Locator } from '@playwright/test';
import { chooseColor } from '../helpers';
import { sectionAppearance } from '../../src/model/palette';

const css = (target: Locator, property: string) =>
  target.evaluate(
    (node, property) => getComputedStyle(node).getPropertyValue(property),
    property,
  );
const rgb = (hex: string) =>
  `rgb(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`;

test('the title is a raised field as tall as the header buttons, with a pencil and a dot for unsaved changes', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const field = page.locator('.title-field');
  const input = page.getByLabel('Project title');
  const pencil = field.locator('svg');
  const header = page.locator('header');
  const save = page.getByRole('button', { name: 'Download', exact: true });
  // At rest: a raised outline, a pencil, and the height of the buttons beside it.
  await expect(pencil).toBeVisible();
  expect(await css(field, 'border-top-width')).toBe('1px');
  expect(await css(field, 'border-top-color')).toBe('rgb(228, 228, 231)');
  const shadow = await css(field, 'box-shadow');
  expect(shadow).not.toBe('none');
  const grey = 'rgb(113, 113, 122)';
  expect(await css(pencil, 'stroke')).toBe(grey);
  expect(await css(field, 'cursor')).toBe('text');
  await expect(field).toHaveAttribute('title', 'Rename project');
  const resting = (await field.boundingBox())!;
  const button = (await save.boundingBox())!;
  expect(resting.width).toBe(340);
  expect(resting.height).toBe(button.height);
  expect(resting.y).toBe(button.y);
  const headerHeight = (await header.boundingBox())!.height;
  // Hover strengthens the outline and fills the field; the pencil is part of the click target.
  await field.hover();
  await expect
    .poll(() => css(field, 'border-top-color'))
    .toBe('rgb(212, 212, 216)');
  await expect
    .poll(() => css(field, 'background-color'))
    .toBe('rgb(244, 244, 245)');
  expect(await css(pencil, 'stroke')).toBe(grey);
  await pencil.click();
  await expect(input).toBeFocused();
  // Editing stays neutral: the stronger grey outline on white, no glow, no apricot.
  await expect
    .poll(() => css(field, 'background-color'))
    .toBe('rgb(255, 255, 255)');
  expect(await css(field, 'border-top-color')).toBe('rgb(212, 212, 216)');
  expect(await css(field, 'box-shadow')).toBe(shadow);
  expect(await css(pencil, 'stroke')).toBe(grey);
  expect(await css(input, 'outline-style')).toBe('none');
  // The field keeps its size whatever the length of the title.
  await input.fill('A considerably longer project title');
  expect((await field.boundingBox())!.width).toBe(340);
  await input.press('Escape');
  await expect(input).toHaveValue('Untitled');
  await expect(input).not.toBeFocused();
  const centre = async () => {
    const box = (await input.boundingBox())!;
    return box.x + box.width / 2;
  };
  const before = await centre();
  await input.fill('  Launch plan  ');
  await input.press('Enter');
  await expect(input).toHaveValue('Launch plan');
  // Unsaved changes show as an apricot dot inside the field, before the title.
  const dot = page.getByLabel('Modified', { exact: true });
  await expect(dot).toBeVisible();
  expect(await css(dot, 'background-color')).toBe('rgb(179, 93, 53)');
  expect(await dot.evaluate((node) => !!node.closest('.title-field'))).toBe(
    true,
  );
  expect((await dot.boundingBox())!.x).toBeLessThan(
    (await input.boundingBox())!.x,
  );
  // The dot moves nothing: its place is reserved.
  expect(await centre()).toBe(before);
  expect((await field.boundingBox())!.width).toBe(340);
  expect((await header.boundingBox())!.height).toBe(headerHeight);
});

test('a very long title stays inside the header', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const input = page.getByLabel('Project title');
  await input.fill('An extraordinarily long project title '.repeat(4));
  await input.press('Enter');
  const field = (await page.locator('.title-field').boundingBox())!;
  const home = (await page
    .getByRole('button', { name: 'Home', exact: true })
    .boundingBox())!;
  const save = (await page
    .getByRole('button', { name: 'Download', exact: true })
    .boundingBox())!;
  expect(field.x).toBeGreaterThan(home.x + home.width);
  expect(field.x + field.width).toBeLessThan(save.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    800,
  );
});

test('the header button downloads the project on web and is the apricot primary action', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const save = page.getByRole('button', { name: 'Download', exact: true });
  expect(await css(save, 'background-color')).toBe('rgb(179, 93, 53)');
  expect(await css(save, 'color')).toBe('rgb(255, 255, 255)');
  await expect(save.locator('kbd')).toHaveText(/S$/);
  await expect(save).toBeEnabled();
  await page.getByLabel('Project title').fill('Header download');
  await page.getByLabel('Project title').press('Enter');
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await save.click();
  expect((await download).suggestedFilename()).toMatch(/\.takt$/);
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
});

test('section heading rows carry their section color across the chart and follow recoloring and undo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const heading = page.getByTestId('section-section-1');
  const label = heading.locator('.section-label');
  const other = page.getByTestId('section-section-2');
  const lavender = sectionAppearance(300),
    sea = sectionAppearance(210),
    sage = sectionAppearance(145);
  expect(await css(heading, 'background-color')).toBe(rgb(lavender.tint));
  expect(await css(label, 'background-color')).toBe(rgb(lavender.tint));
  expect(await css(label, 'color')).toBe(rgb(lavender.ink));
  expect(await css(heading.locator('.section-color'), 'background-color')).toBe(
    rgb(lavender.mark),
  );
  expect(await css(other, 'background-color')).toBe(rgb(sea.tint));
  // The tint spans the label column and the timeline.
  const bounds = (await heading.boundingBox())!;
  const chart = (await page.locator('.chart').boundingBox())!;
  expect(bounds.width).toBe(chart.width);
  // Rows keep the neutral surface.
  expect(
    await css(page.locator('.row-label').first(), 'background-color'),
  ).toBe('rgb(255, 255, 255)');
  await page
    .getByRole('button', { name: 'Research', exact: true })
    .click({ button: 'right' });
  await chooseColor(page, 'Sage');
  await expect
    .poll(() => css(heading, 'background-color'))
    .toBe(rgb(sage.tint));
  expect(await css(label, 'color')).toBe(rgb(sage.ink));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect
    .poll(() => css(heading, 'background-color'))
    .toBe(rgb(lavender.tint));
});

test('the floating toolbar stays over the chart, opens Zoom upward, and the chart scrolls clear of it', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  const toolbar = page.getByLabel('Editor controls');
  const viewport = page.locator('.viewport');
  const before = (await toolbar.boundingBox())!;
  const zoom = page.getByRole('combobox', { name: 'Zoom', exact: true });
  await zoom.click();
  const list = (await page.getByRole('listbox').boundingBox())!;
  const trigger = (await zoom.boundingBox())!;
  expect(list.y + list.height).toBeLessThanOrEqual(trigger.y);
  expect(list.y).toBeGreaterThanOrEqual(8);
  await page.keyboard.press('Escape');
  await viewport.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.scrollLeft = 80;
  });
  expect(await toolbar.boundingBox()).toEqual(before);
  const add = (await page
    .getByRole('button', { name: 'Add section', exact: true })
    .boundingBox())!;
  expect(add.y + add.height).toBeLessThanOrEqual(before.y);
  // A click on the toolbar never reaches the chart beneath it.
  const bars = await page.locator('.bar').count();
  await page.mouse.move(before.x + 4, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + 120, before.y + before.height / 2);
  await page.mouse.up();
  await expect(page.locator('.bar')).toHaveCount(bars);
});

test('undo reveals a change on the last row above the floating toolbar', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  const viewport = page.locator('.viewport');
  const toolbar = page.getByLabel('Editor controls');
  await viewport.evaluate((node) => (node.scrollTop = node.scrollHeight));
  const lane = page.getByTestId('lane').last();
  const bounds = (await lane.boundingBox())!;
  await page.mouse.move(bounds.x + 40, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 160, bounds.y + bounds.height / 2);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  const created = page.locator('.bar').last();
  await expect(created).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await viewport.evaluate((node) => (node.scrollTop = 0));
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  const top = (await toolbar.boundingBox())!.y;
  await expect
    .poll(async () => {
      const row = (await lane.boundingBox())!;
      return row.y + row.height;
    })
    .toBeLessThanOrEqual(top);
});

test('Home is an apricot start panel beside the project lists, without guide, tagline or storage note', async ({
  page,
}) => {
  await page.goto('/');
  const start = page.locator('.home-start');
  const projects = page.locator('.home-projects');
  expect(await css(start, 'background-color')).toBe('rgb(179, 93, 53)');
  const left = (await start.boundingBox())!;
  const right = (await projects.boundingBox())!;
  expect(left.x).toBe(0);
  expect(left.height).toBe(800);
  expect(right.x).toBe(left.x + left.width);
  const create = page.getByRole('button', { name: 'New project', exact: true });
  expect(await css(create, 'background-color')).toBe('rgb(255, 255, 255)');
  // One card is both the Open button and the drop zone.
  const open = page.getByRole('button', {
    name: 'Open .takt file',
    exact: true,
  });
  await expect(open).toHaveCount(1);
  await expect(open).toHaveClass(/drop-zone/);
  await expect(open).toContainText('Drop a file here or click to browse');
  await expect(start.getByRole('button')).toHaveCount(2);
  for (const removed of [
    'A few simple moves',
    'Give your next idea a timeline.',
    'Your files stay on your device.',
    'A place for your plans',
  ])
    await expect(page.getByText(removed)).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await open.click();
  await chooser;
});

test('the timeline heading row and its year band are white', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const white = 'rgb(255, 255, 255)';
  for (const selector of ['.chart-header', '.lane-heading', '.year-band'])
    expect(await css(page.locator(selector).first(), 'background-color')).toBe(
      white,
    );
});
