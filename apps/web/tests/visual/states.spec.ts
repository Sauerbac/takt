import { test, expect } from '@playwright/test';
import { beginBarDrag, laneGeometry } from '../helpers';

test('Apricot empty editor', async ({ page }) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await expect(page.locator('main')).toHaveScreenshot('empty.png');
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
