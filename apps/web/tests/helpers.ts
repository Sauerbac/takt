import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

export async function laneGeometry(page: Page, row = 0) {
  const element = page.getByTestId('lane').nth(row);
  const bounds = await element.boundingBox();
  if (!bounds) throw new Error('Timeline is not visible');
  const firstWeek = Number(await element.getAttribute('data-first-week'));
  return {
    x: (week: number) => bounds.x + ((week - firstWeek) * bounds.width) / 12,
    y: bounds.y + 22,
    width: bounds.width / 12,
  };
}
export async function draw(
  page: Page,
  from: number,
  to: number,
  name?: string,
) {
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(from), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(to), lane.y, { steps: 5 });
  await page.mouse.up();
  const input = page.getByRole('textbox', { name: 'Bar name' });
  await expect(input).toBeFocused();
  if (name !== undefined) {
    await input.fill(name);
    await input.press('Enter');
  } else await input.press('Escape');
}
export async function interval(bar: Locator, start: number, end: number) {
  await expect(bar).toHaveAttribute('data-start', String(start));
  await expect(bar).toHaveAttribute('data-end', String(end));
}
export async function readyToDrop(page: Page) {
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'true',
  );
}
export async function pauseClock(page: Page) {
  // Initial width measurement can start settlement transitions. Clock-based
  // behavioral tests begin from a settled fixture; interrupted pickup is
  // exercised separately by dedicated motion tests.
  await page.locator('.chart').evaluate(async (element) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      [element, ...element.querySelectorAll('*')].flatMap((element) =>
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
  });
  const time = new Date('2026-10-03T12:00:00Z');
  // Leave room for real time between installation and pausing, especially in Firefox.
  await page.clock.install({ time: new Date(time.getTime() - 60_000) });
  await page.clock.pauseAt(time);
}
export async function beginBarDrag(
  page: Page,
  id: string,
  edge?: 'left' | 'right',
) {
  const target = page.getByTestId(`bar-${id}`);
  const bounds = await target.boundingBox();
  if (!bounds) throw new Error('Bar is not visible');
  const rawX =
    edge === 'left'
      ? bounds.x + 4
      : edge === 'right'
        ? bounds.x + bounds.width - 4
        : bounds.x + bounds.width / 2;
  const x = Math.round(rawX);
  const y = Math.round(bounds.y + bounds.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y };
}
export async function settled(bar: Locator) {
  await bar.evaluate(async (element) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}
export async function expectPosition(
  page: Page,
  id: string,
  start: number,
  end: number,
) {
  const bar = page.getByTestId(`bar-${id}`);
  await interval(bar, start, end);
  await settled(bar);
  const lane = await laneGeometry(page);
  const bounds = await bar.boundingBox();
  expect(bounds!.x).toBeCloseTo(lane.x(start) + 5, 0);
  expect(bounds!.width).toBeCloseTo((end - start) * lane.width - 10, 0);
}
