import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  draw,
  interval,
  laneGeometry,
  pauseClock,
  settled,
  zoomToWeekZero,
} from '../helpers';

test('production editor: draw, name, cascade, cancel, commit, undo and Windows redo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByText('Unnamed section')).toBeVisible();
  await expect(page.getByText('Unnamed row')).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(1);
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
  await expect(
    page.getByRole('heading', { name: 'Resume draft' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.locator('.bar')).toHaveCount(0);
});

test('production editor: cancel an early overlapping drop, pass a neighbor, then dwell to push with atomic history', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  // Motion is covered separately; this scenario advances a controlled gesture clock.
  await page.addStyleTag({ content: '.bar { transition: none !important; }' });
  await draw(page, 0, 1, 'A');
  await draw(page, 2, 3, 'B');
  await draw(page, 4, 5, 'C');
  const a = page.locator('.bar').filter({ hasText: 'A' });
  const b = page.locator('.bar').filter({ hasText: 'B' });
  const c = page.locator('.bar').filter({ hasText: 'C' });
  const id = (await a.getAttribute('data-testid'))!.slice(4);
  await pauseClock(page);
  const lane = await laneGeometry(page);
  let pickup = await beginBarDrag(page, id);
  await page.mouse.move(pickup.x + 2 * lane.width, pickup.y);
  await page.clock.runFor(299);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await page.mouse.up();
  await page.clock.runFor(400);
  await interval(a, 0, 1);
  await interval(b, 2, 3);
  await interval(c, 4, 5);
  // Cancellation did not insert a move command ahead of the last naming entry.
  await page.keyboard.press('Control+z');
  await expect(page.locator('.bar').last().locator('span')).toHaveText('');
  await page.keyboard.press('Control+y');
  await expect(c.locator('span')).toHaveText('C');
  pickup = await beginBarDrag(page, id);
  await page.mouse.move(pickup.x + 2 * lane.width, pickup.y);
  await page.clock.runFor(150);
  await page.mouse.move(pickup.x + 3 * lane.width, pickup.y);
  await page.mouse.up();
  await interval(a, 3, 4);
  await interval(b, 2, 3);
  await interval(c, 4, 5);
  await page.keyboard.press('Control+z');
  await interval(a, 0, 1);
  await page.keyboard.press('Control+y');
  await interval(a, 3, 4);
  pickup = await beginBarDrag(page, id);
  await page.mouse.move(pickup.x + lane.width, pickup.y);
  await page.clock.runFor(300);
  await interval(c, 5, 6);
  await page.mouse.up();
  await page.keyboard.press('Control+z');
  await interval(a, 3, 4);
  await interval(c, 4, 5);
  await page.keyboard.press('Control+y');
  await interval(a, 4, 5);
  await interval(c, 5, 6);
  expect(errors).toEqual([]);
});

test('production editor: draw beyond the initial timeline, name, undo and reveal on redo', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await zoomToWeekZero(page);
  await pauseClock(page);
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(0), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(10) - 8, lane.y);
  await page.clock.runFor(800);
  const bar = page.locator('.bar');
  const end = Number(await bar.getAttribute('data-end'));
  expect(end).toBeGreaterThan(10);
  await page.mouse.up();
  const input = page.getByRole('textbox', { name: 'Bar name' });
  await input.fill('Beyond the initial view');
  await input.press('Enter');
  await page.keyboard.press('Control+z');
  await interval(bar, 0, end);
  await expect(bar.locator('span')).toHaveText('');
  await page.keyboard.press('Control+z');
  await expect(bar).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await interval(bar, 0, end);
  await page.keyboard.press('Control+y');
  await expect(bar.locator('span')).toHaveText('Beyond the initial view');
});
