import { test, expect } from '@playwright/test';
import { draw, interval, laneGeometry, settled } from '../helpers';

test('production editor: draw, name, cascade, cancel, commit, undo and Windows redo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Unnamed section')).toBeVisible();
  await expect(page.getByText('Unnamed row')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await draw(page, 0, 2, 'Research');
  await draw(page, 2, 4, 'Synthesis');
  await draw(page, 4, 5, 'Review');
  const first = page.locator('.bar').filter({ hasText: 'Research' });
  const second = page.locator('.bar').filter({ hasText: 'Synthesis' });
  const third = page.locator('.bar').filter({ hasText: 'Review' });
  await settled(first);
  const lane = await laneGeometry(page);
  const handle = first.getByRole('button', { name: 'Resize end of Research' });
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + lane.width * 2, y);
  await interval(second, 4, 6);
  await interval(third, 6, 7);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await interval(first, 0, 2);
  await interval(second, 2, 4);
  await interval(third, 4, 5);
  await settled(first);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + lane.width * 2, y);
  await page.mouse.move(x + lane.width, y);
  await page.mouse.up();
  await interval(first, 0, 3);
  await interval(second, 3, 5);
  await interval(third, 5, 6);
  await page.keyboard.press('Control+z');
  await interval(first, 0, 2);
  await interval(second, 2, 4);
  await interval(third, 4, 5);
  await page.keyboard.press('Control+y');
  await interval(first, 0, 3);
  await interval(second, 3, 5);
  await interval(third, 5, 6);
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.locator('.bar')).toHaveCount(0);
});
