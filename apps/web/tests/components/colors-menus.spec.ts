import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { beginBarDrag, interval, laneGeometry, settled } from '../helpers';

async function color(page: Page, target: Locator, name: string) {
  await target.click({ button: 'right' });
  await page.getByRole('menuitemradio', { name, exact: true }).click();
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
  await expect(
    page.getByRole('menuitemradio', { name: 'Rose', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
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
  const rename = page.getByRole('menuitem', { name: 'Rename', exact: true });
  await expect(rename).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitemradio', { name: 'Apricot', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  const input = page.getByRole('textbox', { name: 'Bar name', exact: true });
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
