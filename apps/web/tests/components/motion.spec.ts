import { zoomToWeekZero } from '../helpers';
import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  expectPosition,
  interval,
  laneGeometry,
  settled,
  readyToDrop,
  pauseClock,
} from '../helpers';
import type { Locator } from '@playwright/test';

async function halfTransition(bar: Locator, property = 'left') {
  return bar.evaluate(async (element, property) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    const animation = element
      .getAnimations()
      .find(
        (item) =>
          item instanceof CSSTransition && item.transitionProperty === property,
      );
    if (!animation)
      throw new Error(
        `Expected an actual ${property} transition: ${JSON.stringify(element.getAnimations().map((item) => ({ type: item.constructor.name, state: item.playState, timing: item.effect?.getTiming() })))}`,
      );
    animation.pause();
    animation.currentTime = 75;
    return {
      x: element.getBoundingClientRect().x,
      width: element.getBoundingClientRect().width,
      duration: animation.effect!.getTiming().duration,
    };
  }, property);
}

async function freezeTransitions(page: import('@playwright/test').Page) {
  // Pause genuine CSS transitions at their start so slow CI cannot miss the 150ms window.
  await page.evaluate(() => {
    document.addEventListener('transitionrun', (event) => {
      for (const animation of (event.target as HTMLElement).getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
  });
}

for (const escape of [true, false]) {
  test(`after a sustained push, fast ${escape ? 'overtaking animates the neighbor to its original position' : 'retraction animates the neighbor back with the held bar'}`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Chain');
    await zoomToWeekZero(page);
    await pauseClock(page);
    await freezeTransitions(page);
    const lane = await laneGeometry(page);
    const a = page.getByTestId('bar-a');
    const b = page.getByTestId('bar-b');
    const pickup = await beginBarDrag(page, 'a');
    await page.mouse.move(pickup.x + lane.width, pickup.y);
    await page.clock.runFor(300);
    await page.clock.runFor(500);
    await page.mouse.move(pickup.x + 4 * lane.width, pickup.y);
    await interval(b, 6, 8);
    await page.clock.runFor(16);
    await b.evaluate((element) =>
      element.getAnimations().forEach((animation) => animation.finish()),
    );
    const displaced = (await b.boundingBox())!;
    await page.clock.runFor(50);
    await page.mouse.move(pickup.x + (escape ? 5 : 3) * lane.width, pickup.y);
    await page.clock.runFor(16);
    const held = (await a.boundingBox())!;
    const target = escape ? 2 : 5;
    await interval(b, target, target + 2);
    const halfway = await b.evaluate((element) => {
      const animation = element
        .getAnimations()
        .find(
          (item) =>
            item instanceof CSSTransition && item.transitionProperty === 'left',
        );
      if (!animation) throw new Error('Expected retraction to animate left');
      animation.pause();
      animation.currentTime = 75;
      return {
        x: element.getBoundingClientRect().x,
        duration: animation.effect!.getTiming().duration,
      };
    });
    expect(halfway.duration).toBe(150);
    expect(halfway.x).toBeLessThan(displaced.x - 1);
    expect(halfway.x).toBeGreaterThan(lane.x(target) + 6);
    await expect(page.getByTestId('snap-preview')).toHaveAttribute(
      'data-valid',
      'true',
    );
    expect((await a.boundingBox())!.x).toBeCloseTo(held.x, 0);
    expect(await a.evaluate((element) => element.getAnimations().length)).toBe(
      0,
    );
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await interval(a, 0, 2);
    await interval(b, 2, 4);
  });
}

test('returning after an overtake animates the neighbor toward the new approach side without moving the held bar', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Separated');
  await zoomToWeekZero(page);
  const a = page.getByTestId('bar-a');
  const b = page.getByTestId('bar-b');
  await settled(a);
  await settled(b);
  await freezeTransitions(page);
  const lane = await laneGeometry(page);
  const originalB = (await b.boundingBox())!;
  const pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x + 3 * lane.width, pickup.y);
  await interval(b, 2, 3);
  await page.mouse.move(pickup.x + 2 * lane.width, pickup.y);
  const held = (await a.boundingBox())!;
  await readyToDrop(page);
  await interval(b, 1, 2);
  const halfway = await halfTransition(b);
  expect(halfway.duration).toBe(150);
  expect(halfway.x).toBeLessThan(originalB.x - 1);
  expect(halfway.x).toBeGreaterThan(lane.x(1) + 6);
  expect((await a.boundingBox())!.x).toBeCloseTo(held.x, 0);
  expect(await a.evaluate((element) => element.getAnimations().length)).toBe(0);
  await b.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  );
  await expectPosition(page, 'b', 1, 2);
  await page.mouse.up();
  await interval(a, 2, 3);
  await interval(b, 1, 2);
});

for (const edge of [undefined, 'left', 'right'] as const) {
  test(`grabbing a settling bar by ${edge ?? 'body'} preserves its displayed geometry`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Chain');
    await zoomToWeekZero(page);
    const bar = page.getByTestId('bar-a');
    await settled(bar);
    await freezeTransitions(page);
    const lane = await laneGeometry(page);
    // First create a genuine position or width settlement, then stop it halfway.
    const resize = edge !== undefined;
    const first = await beginBarDrag(page, 'a', resize ? edge : undefined);
    await page.mouse.move(
      first.x + Math.round(lane.width * 0.7) * (edge === 'left' ? -1 : 1),
      first.y,
    );
    await readyToDrop(page);
    await page.mouse.up();
    await halfTransition(bar, resize ? 'width' : 'left');
    const displayed = (await bar.boundingBox())!;
    const pickup = await beginBarDrag(page, 'a', edge);
    const pressed = (await bar.boundingBox())!;
    expect(pressed.x).toBeCloseTo(displayed.x, 0);
    expect(pressed.width).toBeCloseTo(displayed.width, 0);
    await page.mouse.move(pickup.x + 8, pickup.y);
    const tracking = (await bar.boundingBox())!;
    expect(tracking.x - displayed.x).toBeCloseTo(edge === 'right' ? 0 : 8, 0);
    expect(tracking.width - displayed.width).toBeCloseTo(
      edge === 'left' ? -8 : edge === 'right' ? 8 : 0,
      0,
    );
    expect(
      await bar.evaluate((element) => element.getAnimations().length),
    ).toBe(0);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    // Cancelling the second gesture restores the first committed result, never a fractional document.
    const committedStart = edge === 'left' ? -1 : edge === undefined ? 1 : 0;
    const committedEnd = edge === 'left' ? 2 : 3;
    await interval(bar, committedStart, committedEnd);
    await page.keyboard.press('Control+z');
    await interval(bar, 0, 2);
    await page.keyboard.press('Control+y');
    await interval(bar, committedStart, committedEnd);
  });
}

test('pointer attachment is immediate; displaced bars animate and reverse; release settles for 150ms', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await zoomToWeekZero(page);
  const lane = await laneGeometry(page);
  const a = page.getByTestId('bar-a');
  const b = page.getByTestId('bar-b');
  await settled(a);
  await settled(b);
  await freezeTransitions(page);
  const beforeA = await a.boundingBox();
  const beforeB = await b.boundingBox();
  const from = await beginBarDrag(page, 'a');
  const distance = Math.round(lane.width * 0.7);
  await page.mouse.move(from.x + distance, from.y);
  await interval(a, 1, 3);
  const tracking = await a.boundingBox();
  expect(tracking!.x - beforeA!.x).toBeCloseTo(distance, 0);
  expect(await a.evaluate((element) => element.getAnimations().length)).toBe(0);
  await readyToDrop(page);
  const halfway = await halfTransition(b);
  expect(halfway.duration).toBe(150);
  expect(halfway.x).toBeGreaterThan(beforeB!.x + 1);
  expect(halfway.x).toBeLessThan(lane.x(3) + 4);
  // Finish the outbound animation, then verify reversal has its own observable intermediate position.
  await b.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  );
  await page.mouse.move(from.x, from.y);
  await interval(b, 2, 4);
  const reverse = await halfTransition(b);
  expect(reverse.x).toBeGreaterThan(beforeB!.x + 1);
  expect(reverse.x).toBeLessThan(lane.x(3) + 4);
  await b.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  );
  await expectPosition(page, 'b', 2, 4);
  await page.mouse.move(from.x + distance, from.y);
  await readyToDrop(page);
  await page.mouse.up();
  const settlement = await halfTransition(a);
  expect(settlement.duration).toBe(150);
  expect(settlement.x).toBeGreaterThan(beforeA!.x + distance);
  expect(settlement.x).toBeLessThan(lane.x(1) + 5);
  await page
    .locator('.bar')
    .evaluateAll((elements) =>
      elements.forEach((element) =>
        element.getAnimations().forEach((animation) => animation.finish()),
      ),
    );
  await expectPosition(page, 'a', 1, 3);
  await page
    .getByTestId('bar-c')
    .evaluate((element) =>
      element.getAnimations().forEach((animation) => animation.finish()),
    );
  await expectPosition(page, 'b', 3, 5);
  await expectPosition(page, 'c', 5, 6);
});

test('a bar still gliding from a collision can be picked up without a jump', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await zoomToWeekZero(page);
  const a = page.getByTestId('bar-a'),
    b = page.getByTestId('bar-b');
  await settled(a);
  await settled(b);
  await freezeTransitions(page);
  const lane = await laneGeometry(page);
  const from = await beginBarDrag(page, 'a');
  await page.mouse.move(from.x + Math.round(lane.width * 0.7), from.y);
  await readyToDrop(page);
  await page.mouse.up();
  await a.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  );
  await halfTransition(b);
  const displayed = (await b.boundingBox())!;
  const pickup = await beginBarDrag(page, 'b');
  expect((await b.boundingBox())!.x).toBeCloseTo(displayed.x, 0);
  await page.mouse.move(pickup.x + 8, pickup.y);
  expect((await b.boundingBox())!.x - displayed.x).toBeCloseTo(8, 0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await interval(a, 1, 3);
  await interval(b, 3, 5);
  await page.keyboard.press('Control+z');
  await interval(a, 0, 2);
  await interval(b, 2, 4);
});

test('resize tracks width immediately and animates the final snapped width', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await zoomToWeekZero(page);
  const a = page.getByTestId('bar-a');
  await settled(a);
  await freezeTransitions(page);
  const lane = await laneGeometry(page);
  const before = (await a.boundingBox())!;
  const from = await beginBarDrag(page, 'a', 'right');
  const distance = Math.round(lane.width * 0.7);
  await page.mouse.move(from.x + distance, from.y);
  const tracking = (await a.boundingBox())!;
  expect(tracking.x).toBeCloseTo(before.x, 0);
  expect(tracking.width - before.width).toBeCloseTo(distance, 0);
  expect(await a.evaluate((element) => element.getAnimations().length)).toBe(0);
  await page.mouse.up();
  const halfway = await halfTransition(a, 'width');
  expect(halfway.duration).toBe(150);
  expect(halfway.width).toBeGreaterThan(tracking.width);
  expect(halfway.width).toBeLessThan(3 * lane.width - 10);
  await page
    .locator('.bar')
    .evaluateAll((elements) =>
      elements.forEach((element) =>
        element.getAnimations().forEach((animation) => animation.finish()),
      ),
    );
  await expectPosition(page, 'a', 0, 3);
  await expectPosition(page, 'b', 3, 5);
  await expectPosition(page, 'c', 5, 6);
});

test('a one-week creation can be resized during width settlement without jumping', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await zoomToWeekZero(page);
  const lane = await laneGeometry(page);
  await freezeTransitions(page);
  await page.mouse.move(lane.x(3), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(3) + 4, lane.y);
  await page.mouse.up();
  const input = page.getByRole('textbox', { name: 'Bar name' });
  await expect(input).toBeFocused();
  const bar = page.locator('.bar');
  await halfTransition(bar, 'width');
  await input.press('Escape');
  const displayed = (await bar.boundingBox())!;
  const id = (await bar.getAttribute('data-testid'))!.slice(4);
  const pickup = await beginBarDrag(page, id, 'right');
  await page.mouse.move(pickup.x + 8, pickup.y);
  expect((await bar.boundingBox())!.width - displayed.width).toBeCloseTo(8, 0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await interval(bar, 3, 4);
  await page.keyboard.press('Control+z');
  await expect(bar).toHaveCount(0);
});
