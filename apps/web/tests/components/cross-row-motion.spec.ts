import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  interval,
  laneGeometry,
  readyToDrop,
  settled,
  zoomToWeekZero,
} from '../helpers';
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
  await readyToDrop(page);
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
  await page.mouse.move(pickup.x + third.width * 2.3, third.y + 6);
  await page.mouse.up();
  const settle = await halfway(bar, 'top');
  expect(settle.duration).toBe(150);
  expect(settle.y).toBeGreaterThan(third.y - 14);
  expect(settle.y).toBeLessThan(third.y - 8);
});

for (const direction of ['left', 'right'] as const) {
  test(`a ${direction} destination push and restoration animate after fresh row contact`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=RowEntry');
    await zoomToWeekZero(page);
    const destination = await laneGeometry(page),
      source = await laneGeometry(page, 1);
    const neighbor = page.getByTestId('bar-b'),
      bar = page.getByTestId('bar-a');
    await settled(neighbor);
    await freeze(page);
    const original = (await neighbor.boundingBox())!;
    await beginBarDrag(page, 'a');
    await page.mouse.move(
      destination.x(direction === 'left' ? 4.5 : 0.5),
      destination.y,
    );
    // Separate the two moves so velocity cannot trigger the speed escape.
    await page.waitForTimeout(300);
    await page.mouse.move(destination.x(2.5), destination.y);
    await expect(page.getByTestId('snap-preview')).toHaveAttribute(
      'data-valid',
      'false',
    );
    await interval(neighbor, 2, 3);
    const held = (await bar.boundingBox())!;
    expect(held.x + held.width / 2).toBeCloseTo(destination.x(2.5), 0);
    expect(held.y + held.height / 2).toBeCloseTo(destination.y, 0);
    await readyToDrop(page);
    const push = await halfway(neighbor, 'left');
    expect(push.duration).toBe(150);
    const finalX = destination.x(direction === 'left' ? 1 : 3) + 5;
    expect(push.x).toBeGreaterThan(Math.min(original.x, finalX) + 1);
    expect(push.x).toBeLessThan(Math.max(original.x, finalX) - 1);
    await neighbor.evaluate((element) =>
      element.getAnimations().forEach((animation) => animation.finish()),
    );
    const displaced = (await neighbor.boundingBox())!;
    await page.mouse.move(destination.x(2.5), source.y);
    const restore = await halfway(neighbor, 'left');
    expect(restore.duration).toBe(150);
    expect(restore.x).toBeGreaterThan(Math.min(original.x, displaced.x) + 1);
    expect(restore.x).toBeLessThan(Math.max(original.x, displaced.x) - 1);
    await page.mouse.up();
  });
}

test('both destination chains animate outward and back when inserting between bars', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=BetweenBars');
  const destination = await laneGeometry(page),
    source = await laneGeometry(page, 1);
  const left = page.getByTestId('bar-b'),
    right = page.getByTestId('bar-c');
  await settled(left);
  await settled(right);
  await freeze(page);
  const leftOriginal = (await left.boundingBox())!,
    rightOriginal = (await right.boundingBox())!;
  const pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x, destination.y);
  await readyToDrop(page);
  const leftPush = await halfway(left, 'left'),
    rightPush = await halfway(right, 'left');
  expect(leftPush.duration).toBe(150);
  expect(rightPush.duration).toBe(150);
  expect(leftPush.x).toBeLessThan(leftOriginal.x - 1);
  expect(leftPush.x).toBeGreaterThan(destination.x(-2) + 5);
  expect(rightPush.x).toBeGreaterThan(rightOriginal.x + 1);
  expect(rightPush.x).toBeLessThan(destination.x(5) + 5);
  for (const item of [left, right])
    await item.evaluate((element) =>
      element.getAnimations().forEach((animation) => animation.finish()),
    );
  const leftDisplaced = (await left.boundingBox())!,
    rightDisplaced = (await right.boundingBox())!;
  await page.mouse.move(pickup.x, source.y);
  const leftRestore = await halfway(left, 'left'),
    rightRestore = await halfway(right, 'left');
  expect(leftRestore.duration).toBe(150);
  expect(rightRestore.duration).toBe(150);
  expect(leftRestore.x).toBeGreaterThan(leftDisplaced.x + 1);
  expect(leftRestore.x).toBeLessThan(leftOriginal.x - 1);
  expect(rightRestore.x).toBeLessThan(rightDisplaced.x - 1);
  expect(rightRestore.x).toBeGreaterThan(rightOriginal.x + 1);
  await page.mouse.up();
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
