import { test, expect } from '@playwright/test';
import { beginBarDrag, laneGeometry, settled } from '../helpers';
import type { Locator, Page } from '@playwright/test';

async function freeze(page: Page) {
  await page.evaluate(() => {
    document.addEventListener('transitionrun', (event) => {
      for (const animation of (event.target as HTMLElement).getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
  });
}
async function halfway(target: Locator, property: string) {
  return target.evaluate(async (element, property) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    const animation = element
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSTransition &&
          animation.transitionProperty === property,
      );
    if (!animation) throw new Error(`Expected ${property} transition`);
    animation.pause();
    animation.currentTime = 75;
    return {
      duration: animation.effect!.getTiming().duration,
      x: element.getBoundingClientRect().x,
      y: element.getBoundingClientRect().y,
    };
  }, property);
}

test('cross-row pushes and restoration animate while the carried bar tracks both axes immediately', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  await settled(page.getByTestId('bar-a'));
  await settled(page.getByTestId('bar-b'));
  await freeze(page);
  const second = await laneGeometry(page, 1),
    third = await laneGeometry(page, 2);
  const neighbor = page.getByTestId('bar-b'),
    bar = page.getByTestId('bar-a');
  const original = (await neighbor.boundingBox())!;
  const pickup = await beginBarDrag(page, 'a');
  const movedX = Math.round(pickup.x + second.width * 0.2);
  await page.mouse.move(movedX, second.y);
  const held = (await bar.boundingBox())!;
  expect(held.y + held.height / 2).toBeCloseTo(second.y, 0);
  expect(Math.abs(held.x + held.width / 2 - movedX)).toBeLessThan(1);
  expect(
    await bar.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s');
  const push = await halfway(neighbor, 'left');
  expect(push.duration).toBe(150);
  expect(push.x).toBeGreaterThan(original.x + 1);
  expect(push.x).toBeLessThan(second.x(2) + 4);
  await neighbor.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  );
  const displaced = (await neighbor.boundingBox())!;
  await page.mouse.move(pickup.x, third.y);
  const restore = await halfway(neighbor, 'left');
  expect(restore.duration).toBe(150);
  expect(restore.x).toBeGreaterThan(original.x + 1);
  expect(restore.x).toBeLessThan(displaced.x - 1);
  // Release at a non-centered vertical offset and verify the actual settlement.
  await page.mouse.move(pickup.x, third.y + 6);
  await page.mouse.up();
  const settle = await halfway(bar, 'top');
  expect(settle.duration).toBe(150);
  expect(settle.y).toBeGreaterThan(third.y - 14);
  expect(settle.y).toBeLessThan(third.y - 8);
});

test('milestone movement tracks immediately and its snapped horizontal and vertical settlement animates', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  await settled(page.getByTestId('milestone-m'));
  await freeze(page);
  const item = page.getByTestId('milestone-m'),
    second = await laneGeometry(page, 1);
  const original = (await item.boundingBox())!;
  const x = Math.round(original.x + 2),
    y = Math.round(original.y + 14);
  await page.mouse.move(x, y);
  await page.mouse.down();
  const movedX = Math.round(x + second.width * 0.7);
  await page.mouse.move(movedX, second.y + 6);
  const held = (await item.boundingBox())!;
  expect(held.x).toBeCloseTo(original.x + movedX - x, 0);
  expect(held.y + 14).toBeCloseTo(second.y + 6, 0);
  expect(
    await item.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s');
  await page.mouse.up();
  const horizontal = await halfway(item, 'left'),
    vertical = await halfway(item, 'top');
  expect(horizontal.duration).toBe(150);
  expect(vertical.duration).toBe(150);
  expect(horizontal.x).toBeGreaterThan(held.x);
  expect(horizontal.x).toBeLessThan(second.x(6));
  expect(vertical.y).toBeGreaterThan(second.y - 14);
  expect(vertical.y).toBeLessThan(held.y);
});
