import { chooseZoom } from '../helpers';
import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  laneGeometry,
  pauseClock,
  readyToDrop,
  settled,
} from '../helpers';

test('Apricot calendar reference menus expose setup, replacement and clearing', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await page.locator('[data-week="3"]').click({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveScreenshot(
    'set-reference-menu.png',
  );
  await page.keyboard.press('Escape');
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  await page.getByRole('button', { name: 'Dates', exact: true }).click({
    button: 'right',
  });
  await expect(page.getByRole('menu')).toHaveScreenshot(
    'reset-reference-menu.png',
  );
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menu')).toHaveScreenshot(
    'clear-reference-menu.png',
  );
});

test('Apricot context menus group timeline, row, section and milestone actions', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  await page.locator('.section-name').first().click({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveScreenshot('section-menu.png');
  await page.keyboard.press('Escape');
  await page.locator('.row-name').first().click({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveScreenshot('row-menu.png');
  await page.keyboard.press('Escape');
  await page
    .getByTestId('lane')
    .first()
    .click({ button: 'right', position: { x: 800, y: 3 } });
  await expect(page.getByRole('menu')).toBeFocused();
  await expect(page.getByRole('menu')).toHaveScreenshot('timeline-menu.png');
  await page
    .getByRole('menuitem', { name: 'Add bar here', exact: true })
    .hover();
  await expect(page.getByRole('menu')).toHaveScreenshot(
    'timeline-menu-hover.png',
  );
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menu')).toHaveScreenshot(
    'timeline-menu-keyboard.png',
  );
  await page.keyboard.press('Escape');
  await page.getByTestId('milestone-m').click({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveScreenshot('milestone-menu.png');
});

test('Apricot custom zoom menu and selected date draft', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'));
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  await page.getByRole('combobox', { name: 'Zoom', exact: true }).click();
  await expect(page.locator('main')).toHaveScreenshot('zoom-menu.png');
  await page.keyboard.press('Escape');
  await page.locator('[data-week="3"]').click();
  await page.getByRole('button', { name: '12 Oct 2026', exact: true }).click();
  await expect(page).toHaveScreenshot('calendar-selected.png');
});

test('Apricot calendar dates, inherited colors, item palettes and calendar setup', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'));
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  await expect(page.locator('main')).toHaveScreenshot('calendar-colors.png');
  await page.getByTestId('bar-b').click({ button: 'right' });
  await expect(page.locator('main')).toHaveScreenshot('item-palette.png');
  await page.keyboard.press('Escape');
  await page.locator('[data-week="3"]').click();
  await expect(page).toHaveScreenshot('calendar-picker.png');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await chooseZoom(page, '0.5');
  await expect(page.locator('main')).toHaveScreenshot(
    'calendar-zoomed-out.png',
  );
});

test('Apricot structural controls, collapsed sections, insertion preview and scoped confirmation', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  await expect(page.locator('main')).toHaveScreenshot('sections.png');
  await page
    .getByRole('button', { name: 'Collapse Delivery', exact: true })
    .click();
  await expect(page.locator('main')).toHaveScreenshot('collapsed-section.png');
  const source = (await page
    .getByRole('button', { name: 'Discovery', exact: true })
    .boundingBox())!;
  const destination = (await page
    .getByRole('button', { name: 'Empty', exact: true })
    .boundingBox())!;
  await page.mouse.move(source.x + 10, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + 10, destination.y + 20);
  await expect(page.locator('main')).toHaveScreenshot(
    'row-insertion-preview.png',
  );
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page
    .getByRole('button', { name: 'Research', exact: true })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Delete section…', exact: true })
    .click();
  await expect(page).toHaveScreenshot('container-confirmation.png');
});

test('Apricot collapsed section drag keeps its hidden contents out of the carried group', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  await page
    .getByRole('button', { name: 'Collapse Research', exact: true })
    .click();
  await settled(page.getByTestId('section-section-2'));
  const label = (await page
    .getByRole('button', { name: 'Research', exact: true })
    .boundingBox())!;
  await page.mouse.move(label.x + 10, label.y + label.height / 2);
  await page.mouse.down();
  await page.mouse.move(label.x + 10, label.y + label.height / 2 + 200);
  await expect(page.locator('main')).toHaveScreenshot(
    'collapsed-section-drag.png',
  );
});

test('Apricot section naming uses the full name area without changing its style', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  await page.locator('.section-name').click();
  const input = page.getByRole('textbox', { name: 'Section name' });
  await expect(input).toBeFocused();
  await input.fill('Product planning');
  await expect(page.locator('main')).toHaveScreenshot(
    'section-inline-name.png',
  );
});

test('Apricot milestone naming preserves the inline label style', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const item = page.getByTestId('milestone-m');
  await settled(item);
  const before = (await item.locator('span').boundingBox())!;
  const label = (await item.locator('span').boundingBox())!;
  await page.mouse.dblclick(
    label.x + label.width / 2,
    label.y + label.height / 2,
  );
  const input = page.getByRole('textbox', { name: 'Milestone name' });
  await expect(input).toBeFocused();
  await input.press('ArrowRight');
  const editing = (await input.boundingBox())!;
  expect(editing.x).toBeCloseTo(before.x, 0);
  expect(editing.y).toBeCloseTo(before.y, 0);
  await expect(page.locator('main')).toHaveScreenshot(
    'milestone-inline-name.png',
  );
});

test('Apricot row naming preserves the inline label style', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const label = page.getByRole('button', { name: 'Research', exact: true });
  const before = (await label.boundingBox())!;
  await label.dblclick();
  const input = page.getByRole('textbox', { name: 'Row name' });
  await expect(input).toBeFocused();
  await input.press('ArrowRight');
  const editing = (await input.boundingBox())!;
  expect(editing.x).toBeCloseTo(before.x, 0);
  expect(editing.y).toBeCloseTo(before.y, 0);
  await expect(page.locator('main')).toHaveScreenshot('row-inline-name.png');
});

test('Apricot chart selection and hover keep the same appearance and every bar shows both handles', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const main = page.locator('main');
  await page.mouse.move(10, 10);
  await expect(main).toHaveScreenshot('quiet-selection.png');
  await page.getByTestId('bar-a').hover();
  await expect(main).toHaveScreenshot('quiet-selection.png');
  await page.getByTestId('bar-a').click();
  await expect(main).toHaveScreenshot('quiet-selection.png');
  const box = (await page.getByTestId('milestone-m').boundingBox())!;
  await page.mouse.click(box.x + 2, box.y + 14);
  await expect(main).toHaveScreenshot('quiet-selection.png');
  await page.getByRole('button', { name: 'Research', exact: true }).focus();
  await expect(main).toHaveScreenshot('quiet-selection.png');
  await page.locator('.viewport').focus();
  await expect(main).toHaveScreenshot('quiet-selection.png');
});

test('Apricot cross-row cascade and milestones', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  await expect(page.locator('main')).toHaveScreenshot('cross-rows.png');
  const lane = await laneGeometry(page, 1),
    pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x, lane.y);
  await readyToDrop(page);
  await expect(page.locator('main')).toHaveScreenshot('cross-row-preview.png');
});

test('Apricot invalid duplicate milestone drop', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const lane = await laneGeometry(page, 1),
    box = (await page.getByTestId('milestone-m').boundingBox())!;
  await page.mouse.move(Math.round(box.x + 2), Math.round(box.y + 14));
  await page.mouse.down();
  await page.mouse.move(Math.round(box.x + 2 - 2 * lane.width), lane.y);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await expect(page.locator('main')).toHaveScreenshot(
    'duplicate-milestone.png',
  );
});

test('Apricot empty editor', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await expect(page.locator('main')).toHaveScreenshot('empty.png');
});

test('Apricot pending collision is visibly invalid and activation retains the cascade preview', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await pauseClock(page);
  const lane = await laneGeometry(page);
  const pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x + Math.round(lane.width * 0.7), pickup.y);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await expect(page.locator('main')).toHaveScreenshot('pending-move.png');
  await page.clock.runFor(300);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'true',
  );
  await expect(page.locator('main')).toHaveScreenshot('activated-move.png');
});

test('Apricot names remain pinned while the narrow timeline scrolls horizontally', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(3), lane.y);
  await page.mouse.wheel(240, 0);
  await expect
    .poll(() =>
      page.locator('.viewport').evaluate((element) => element.scrollLeft),
    )
    .toBeGreaterThan(200);
  await expect(page.locator('main')).toHaveScreenshot('pinned-labels.png');
});

test('Apricot edge scrolling keeps headings, grid, preview and dragged bar aligned', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await pauseClock(page);
  const lane = await laneGeometry(page);
  await beginBarDrag(page, 'a');
  await page.mouse.move(lane.x(10) - 20, lane.y);
  await page.clock.runFor(400);
  await expect(page.locator('main')).toHaveScreenshot('edge-scroll.png');
});
test('Apricot selected bar, clipped label, and inline naming', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Narrow');
  await page.getByTestId('bar-a').click();
  await expect(page.locator('main')).toHaveScreenshot('selected-narrow.png');
  await page.getByTestId('bar-a').dblclick();
  await expect(page.getByRole('textbox', { name: 'Bar name' })).toBeFocused();
  await expect(page.locator('main')).toHaveScreenshot('inline-name.png');
});
test('Apricot whole-week ghost and cascading preview', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await expect(page.locator('main')).toHaveScreenshot('populated.png');
  const lane = await laneGeometry(page);
  const from = await beginBarDrag(page, 'a', 'right');
  await page.mouse.move(from.x + lane.width * 1.3, from.y);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-end',
    '3',
  );
  await expect(page.locator('main')).toHaveScreenshot('cascade-preview.png');
});

test('Apricot dragging at the left timeline boundary preserves the label column', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await pauseClock(page);
  const lane = await laneGeometry(page);
  const from = await beginBarDrag(page, 'a');
  await page.mouse.move(from.x - lane.width * 2.4, from.y);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-start',
    '-2',
  );
  await expect(page.locator('main')).toHaveScreenshot('left-boundary.png');
});
