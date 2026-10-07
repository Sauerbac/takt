import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import {
  beginBarDrag,
  interval,
  laneGeometry,
  settled,
  chooseColor,
} from '../helpers';

async function color(page: Page, target: Locator, name: string) {
  await target.click({ button: 'right' });
  await chooseColor(page, name);
}
const fill = (item: Locator) =>
  item.evaluate((node) =>
    getComputedStyle(node).getPropertyValue('--bar-fill').trim(),
  );

test('section colors update inherited items; overrides and inheritance resets have separate undo boundaries', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  const override = page.getByTestId('bar-b');
  const milestone = page.getByTestId('milestone-m');
  expect(await fill(bar)).toBe('#b5a2e0');
  await color(
    page,
    page.getByRole('button', { name: 'Research', exact: true }),
    'Sea blue',
  );
  expect(await fill(bar)).toBe('#a0d4dd');
  expect(await fill(milestone)).toBe('#a0d4dd');
  expect(await fill(override)).toBe('#f3b184');
  await color(page, bar, 'Rose');
  expect(await fill(bar)).toBe('#b37976');
  await bar.click({ button: 'right' });
  await expect(page.getByRole('menu').locator('.color-label')).toContainText(
    'Rose',
  );
  await page
    .getByRole('menuitem', { name: 'Use section color', exact: true })
    .click();
  expect(await fill(bar)).toBe('#a0d4dd');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await fill(bar)).toBe('#b37976');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await fill(bar)).toBe('#a0d4dd');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await fill(bar)).toBe('#b5a2e0');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await fill(bar)).toBe('#a0d4dd');
});

test('moving bars and milestones between sections adopts destination color while explicit overrides survive', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const destination = await laneGeometry(page, 1);
  await settled(page.getByTestId('bar-a'));
  const pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x, destination.y);
  expect(await fill(page.getByTestId('bar-a'))).toBe('#a0d4dd');
  await page.mouse.up();
  await expect(page.getByTestId('bar-a')).toHaveAttribute('data-row', 'row-2');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await fill(page.getByTestId('bar-a'))).toBe('#b5a2e0');
  await color(page, page.getByTestId('bar-a'), 'Rose');
  await settled(page.getByTestId('bar-a'));
  const again = await beginBarDrag(page, 'a');
  await page.mouse.move(again.x, destination.y);
  await page.mouse.up();
  expect(await fill(page.getByTestId('bar-a'))).toBe('#b37976');
  const milestone = page.getByTestId('milestone-m');
  await settled(milestone);
  const point = (await milestone.boundingBox())!;
  await page.mouse.move(point.x + 2, point.y + 14);
  await page.mouse.down();
  await page.mouse.move(point.x + 2, destination.y);
  await page.mouse.up();
  await expect(milestone).toHaveAttribute('data-row', 'row-2');
  expect(await fill(milestone)).toBe('#a0d4dd');
  await color(page, milestone, 'Slate');
  expect(await fill(milestone)).toBe('#8290a3');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await fill(milestone)).toBe('#a0d4dd');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await fill(milestone)).toBe('#b5a2e0');
});

test('moving a whole row preserves overridden colors, and hidden color history expands and reveals the result', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const source = (await page
    .getByRole('button', { name: 'Discovery', exact: true })
    .boundingBox())!;
  const destination = (await page
    .getByRole('button', { name: 'Build', exact: true })
    .boundingBox())!;
  await page.mouse.move(source.x + 10, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + 10, destination.y + destination.height);
  await page.mouse.up();
  await expect(page.getByTestId('row-row-1')).toHaveAttribute(
    'data-section',
    'section-2',
  );
  expect(await fill(page.getByTestId('bar-a'))).toBe('#a0d4dd');
  expect(await fill(page.getByTestId('bar-b'))).toBe('#f3b184');
  expect(await fill(page.getByTestId('milestone-m'))).toBe('#a0d4dd');
  await interval(page.getByTestId('bar-a'), 0, 2);
  await color(page, page.getByTestId('bar-a'), 'Rose');
  await page
    .getByRole('button', { name: 'Collapse Delivery', exact: true })
    .click();
  await expect(page.getByTestId('bar-a')).toBeHidden();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByTestId('bar-a')).toBeVisible();
  expect(await fill(page.getByTestId('bar-a'))).toBe('#a0d4dd');
});

test('item context menus select, rename inline, reset inheritance and delete immediately with keyboard menu navigation', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  await bar.click({ button: 'right' });
  await expect(bar).toHaveClass(/selected/);
  const input = page
    .getByRole('menu')
    .getByRole('textbox', { name: 'Bar name', exact: true });
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(input).toBeFocused();
  await input.press('Tab');
  await expect(
    page.getByRole('menuitemradio', { name: 'Peach', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(input).toBeFocused();
  expect(
    await input.evaluate((node) =>
      node instanceof HTMLInputElement ? node.selectionStart : null,
    ),
  ).toBe(7);
  await input.fill('Changed');
  await input.press('Enter');
  await bar.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete bar', exact: true }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(bar).toContainText('Changed');
  const milestone = page.getByTestId('milestone-m');
  await milestone.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Milestone name', exact: true })
    .press('Escape');
  await milestone.click({ button: 'right' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.keyboard.press('Delete');
  await expect(milestone).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(milestone).toBeVisible();
  await milestone.click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Delete milestone', exact: true })
    .click();
  await expect(milestone).toHaveCount(0);
});

test('menus opened at the viewport bottom keep the palette and deletion controls reachable', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=TallSections');
  await page.setViewportSize({ width: 900, height: 560 });
  await page.locator('.viewport').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page
    .locator('.section-name')
    .last()
    .click({ button: 'right', position: { x: 10, y: 10 } });
  const menu = page.getByRole('menu');
  const bounds = (await menu.boundingBox())!;
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(560);
});

test('restyled menus clamp to both viewport edges and retain keyboard order across visual groups', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  await page.setViewportSize({ width: 900, height: 560 });
  const lane = (await page.getByTestId('lane').first().boundingBox())!;
  await page.mouse.click(850, lane.y + 3, { button: 'right' });
  let bounds = (await page.getByRole('menu').boundingBox())!;
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(892);
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(
    page.getByRole('menuitem', { name: 'Add milestone here', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await page.locator('.section-name').first().click({ button: 'right' });
  await page.keyboard.press('ArrowUp');
  const deletion = page.getByRole('menuitem', {
    name: 'Delete section…',
    exact: true,
  });
  await expect(deletion).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(
    page.getByRole('menuitem', { name: 'More colors…', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await page.goto('/tests/fixtures/index.html?state=TallSections');
  await page.locator('.viewport').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page
    .locator('.section-name')
    .last()
    .click({ button: 'right', position: { x: 10, y: 10 } });
  bounds = (await page.getByRole('menu').boundingBox())!;
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(892);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(552);
  await expect(deletion).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('pointer and keyboard share one menu highlight without stationary hover overriding arrow navigation', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  await page
    .getByTestId('lane')
    .first()
    .click({ button: 'right', position: { x: 800, y: 3 } });
  const menu = page.getByRole('menu');
  const bar = page.getByRole('menuitem', { name: 'Add bar here', exact: true });
  const milestone = page.getByRole('menuitem', {
    name: 'Add milestone here',
    exact: true,
  });
  const transparent = 'rgba(0, 0, 0, 0)';
  await expect(menu).toBeFocused();
  await expect(bar).toHaveCSS('background-color', transparent);
  await expect(milestone).toHaveCSS('background-color', transparent);
  await bar.hover();
  await expect(bar).toBeFocused();
  await expect(bar).not.toHaveCSS('background-color', transparent);
  await page.keyboard.press('ArrowDown');
  await expect(milestone).toBeFocused();
  await expect(bar).toHaveCSS('background-color', transparent);
  await expect(milestone).not.toHaveCSS('background-color', transparent);
  const bounds = (await bar.boundingBox())!;
  await page.mouse.move(bounds.x + 12, bounds.y + bounds.height / 2);
  await expect(bar).toBeFocused();
  await expect(milestone).toHaveCSS('background-color', transparent);
  await page.mouse.move(10, 10);
  await expect(menu).toBeFocused();
  await expect(bar).toHaveCSS('background-color', transparent);
  await page.keyboard.press('ArrowUp');
  await expect(milestone).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Milestone name', exact: true }),
  ).toBeFocused();
});
