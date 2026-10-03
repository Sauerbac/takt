import { test, expect } from '@playwright/test';
import { beginBarDrag, laneGeometry, pauseClock, settled } from '../helpers';

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
  const lane = await laneGeometry(page);
  const from = await beginBarDrag(page, 'a');
  await page.mouse.move(from.x - lane.width * 2.4, from.y);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-start',
    '-2',
  );
  await expect(page.locator('main')).toHaveScreenshot('left-boundary.png');
});
