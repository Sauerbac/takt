import { zoomToWeekZero } from '../helpers';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { beginBarDrag, interval, laneGeometry, pauseClock } from '../helpers';

async function firstWeek(page: Page) {
  return Number(await page.getByTestId('lane').getAttribute('data-first-week'));
}
async function edges(page: Page) {
  const lane = (await page.getByTestId('lane').boundingBox())!;
  const viewport = await page
    .getByRole('region', { name: 'Whole-week Gantt chart' })
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left + element.clientLeft,
        right: bounds.left + element.clientLeft + element.clientWidth,
      };
    });
  return {
    left: Math.max(lane.x, viewport.left),
    right: Math.min(lane.x + lane.width, viewport.right),
    y: lane.y + 22,
  };
}

for (const direction of ['left', 'right'] as const) {
  for (const operation of ['draw', 'move', 'resize'] as const) {
    test(`${operation} continuously scrolls ${direction} past the initial window, keeps attachment, and commits one action`, async ({
      page,
    }) => {
      await page.goto(
        `/tests/fixtures/index.html?state=${operation === 'draw' ? 'Empty' : 'Chain'}`,
      );
      await zoomToWeekZero(page);
      await pauseClock(page);
      const lane = await laneGeometry(page);
      const edge = await edges(page);
      let pickup: { x: number; y: number };
      if (operation === 'draw') {
        pickup = { x: Math.round(lane.x(0)), y: edge.y };
        await page.mouse.move(pickup.x, pickup.y);
        await page.mouse.down();
      } else
        pickup = await beginBarDrag(
          page,
          'a',
          operation === 'resize' ? direction : undefined,
        );
      const x = Math.round(
        direction === 'left' ? edge.left + 8 : edge.right - 8,
      );
      await page.mouse.move(x, edge.y);
      const bar =
        operation === 'draw' ? page.locator('.bar') : page.getByTestId('bar-a');
      const before = (await bar.boundingBox())!;
      const origin = await firstWeek(page);
      await page.clock.runFor(800);
      const during = (await bar.boundingBox())!;
      const shifted = await firstWeek(page);
      const heading = (await page.locator('[data-week="0"]').boundingBox())!;
      expect(heading.x).toBeCloseTo((await laneGeometry(page)).x(0), 0);
      expect(
        (shifted - origin) * (direction === 'left' ? -1 : 1),
      ).toBeGreaterThan(1.5);
      if (operation === 'move') {
        expect(during.x).toBeCloseTo(before.x, 0);
        expect(during.width).toBeCloseTo(before.width, 0);
      } else if (direction === 'left')
        expect(during.x).toBeCloseTo(before.x, 0);
      else
        expect(during.x + during.width).toBeCloseTo(before.x + before.width, 0);
      expect(
        await bar.evaluate((element) => element.getAnimations().length),
      ).toBe(0);
      const start = Number(await bar.getAttribute('data-start'));
      const end = Number(await bar.getAttribute('data-end'));
      if (direction === 'left') expect(start).toBeLessThan(-2);
      else expect(end).toBeGreaterThan(10);
      if (operation === 'resize')
        expect(direction === 'left' ? end : start).toBe(
          direction === 'left' ? 2 : 0,
        );
      const preview = await page
        .locator('.bar')
        .evaluateAll((bars) =>
          bars.map((bar) => [
            bar.getAttribute('data-start'),
            bar.getAttribute('data-end'),
          ]),
        );
      await page.mouse.up();
      await page.clock.runFor(500);
      expect(await firstWeek(page)).toBe(shifted);
      expect(
        await page
          .locator('.bar')
          .evaluateAll((bars) =>
            bars.map((bar) => [
              bar.getAttribute('data-start'),
              bar.getAttribute('data-end'),
            ]),
          ),
      ).toEqual(preview);
      if (operation === 'draw')
        await page.getByRole('textbox', { name: 'Bar name' }).press('Escape');
      await page.keyboard.press('Control+z');
      if (operation === 'draw')
        await expect(page.locator('.bar')).toHaveCount(0);
      else {
        await interval(page.getByTestId('bar-a'), 0, 2);
        await interval(page.getByTestId('bar-b'), 2, 4);
        await interval(page.getByTestId('bar-c'), 4, 5);
      }
      await expect(
        page.getByRole('button', { name: 'Undo', exact: true }),
      ).toBeDisabled();
      await page.keyboard.press('Control+y');
      await interval(bar, start, end);
      const revealed = await laneGeometry(page);
      const visible = await edges(page);
      expect(revealed.x(start)).toBeGreaterThanOrEqual(visible.left - 1);
      // Longer intervals align their start; bars fitting the window are fully revealed.
      if ((end - start) * revealed.width <= visible.right - visible.left)
        expect(revealed.x(end)).toBeLessThanOrEqual(visible.right + 1);
    });
  }
}

test('edge speed increases toward the boundary and stops on leaving, outside the chart, Escape, and interruption', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await zoomToWeekZero(page);
  await pauseClock(page);
  const edge = await edges(page);
  await beginBarDrag(page, 'a');
  await page.mouse.move(edge.right - 30, edge.y);
  let before = await firstWeek(page);
  await page.clock.runFor(400);
  const slow = (await firstWeek(page)) - before;
  await page.mouse.move(edge.right - 10, edge.y);
  before = await firstWeek(page);
  await page.clock.runFor(400);
  const fast = (await firstWeek(page)) - before;
  expect(slow).toBeGreaterThan(0);
  expect(fast / slow).toBeCloseTo(3, 1);
  for (const x of [(edge.left + edge.right) / 2, edge.right + 20]) {
    await page.mouse.move(x, edge.y);
    before = await firstWeek(page);
    await page.clock.runFor(400);
    expect(await firstWeek(page)).toBe(before);
    await page.mouse.move(edge.right - 10, edge.y);
    await page.clock.runFor(200);
    expect(await firstWeek(page)).toBeGreaterThan(before);
  }
  await page.keyboard.press('Escape');
  await page.mouse.up();
  before = await firstWeek(page);
  await page.clock.runFor(400);
  expect(await firstWeek(page)).toBe(before);
  await interval(page.getByTestId('bar-a'), 0, 2);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  // View changes persist after cancellation; Week 1's coordinates were never renumbered.
  expect(before).not.toBe(-2);
  await expect(page.getByText('Week 1', { exact: true })).toBeVisible();
  await page.clock.runFor(200);
  const pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(edge.left + 8, pickup.y);
  await page.clock.runFor(400);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  before = await firstWeek(page);
  await page.clock.runFor(400);
  expect(await firstWeek(page)).toBe(before);
  await interval(page.getByTestId('bar-a'), 0, 2);
});

test('reversing a scrolled resize restores every collision preview without a history entry', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await zoomToWeekZero(page);
  await pauseClock(page);
  const edge = await edges(page);
  await beginBarDrag(page, 'a', 'right');
  await page.mouse.move(edge.right - 8, edge.y);
  await page.clock.runFor(800);
  expect(
    Number(await page.getByTestId('bar-b').getAttribute('data-start')),
  ).toBeGreaterThan(10);
  const origin = await firstWeek(page);
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(2) - 9, edge.y);
  await interval(page.getByTestId('bar-a'), 0, 2);
  await interval(page.getByTestId('bar-b'), 2, 4);
  await interval(page.getByTestId('bar-c'), 4, 5);
  await page.clock.runFor(400);
  expect(await firstWeek(page)).toBe(origin);
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
});

test('an edge click does not scroll or create; cancelled scrolling preserves redo even in a narrow viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await zoomToWeekZero(page);
  await pauseClock(page);
  const edge = await edges(page);
  await page.mouse.move(edge.right - 8, edge.y);
  await page.mouse.down();
  await page.clock.runFor(400);
  expect(await firstWeek(page)).toBe(-2);
  await page.mouse.up();
  await expect(page.locator('.bar')).toHaveCount(0);
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(0), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(2), lane.y);
  await page.mouse.up();
  await page.getByRole('textbox', { name: 'Bar name' }).press('Escape');
  await page.keyboard.press('Control+z');
  await page.mouse.move(lane.x(0), lane.y);
  await page.mouse.down();
  await page.mouse.move(edge.right - 8, edge.y);
  await page.clock.runFor(400);
  expect(await firstWeek(page)).toBeGreaterThan(-2);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
  await page.keyboard.press('Control+y');
  await interval(page.locator('.bar'), 0, 2);
});
