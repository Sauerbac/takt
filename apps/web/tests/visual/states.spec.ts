import { test, expect } from '@playwright/test';
import { beginBarDrag, laneGeometry, pauseClock } from '../helpers';

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
