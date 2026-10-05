import { zoomToWeekZero } from '../helpers';
import { expect, test } from '@playwright/test';
import {
  beginBarDrag,
  interval,
  laneGeometry,
  pauseClock,
  settled,
} from '../helpers';

for (const direction of ['right', 'left'] as const) {
  test(`slow ${direction} movement keeps pushing beyond the neighbor's original position`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Separated');
    await zoomToWeekZero(page);
    await pauseClock(page);
    const lane = await laneGeometry(page);
    const right = direction === 'right';
    const id = right ? 'a' : 'c';
    const origin = right ? 0 : 5;
    const pickup = await beginBarDrag(page, id);
    await page.mouse.move(pickup.x + (2 - origin) * lane.width, pickup.y);
    await page.clock.runFor(300);
    for (const start of right ? [3, 4, 5, 6, 7] : [1, 0, -1]) {
      await page.clock.runFor(500);
      await page.mouse.move(pickup.x + (start - origin) * lane.width, pickup.y);
      await expect(page.getByTestId('snap-preview')).toHaveAttribute(
        'data-valid',
        'true',
      );
      await interval(page.getByTestId(`bar-${id}`), start, start + 1);
      await interval(
        page.getByTestId('bar-b'),
        right ? start + 1 : start - 1,
        right ? start + 2 : start,
      );
    }
    await page.mouse.up();
    const final = right ? 7 : -1;
    await interval(
      page.getByTestId('bar-b'),
      right ? final + 1 : final - 1,
      right ? final + 2 : final,
    );
    await page.keyboard.press('Control+z');
    await interval(page.getByTestId('bar-a'), 0, 1);
    await interval(page.getByTestId('bar-b'), 2, 3);
    await interval(page.getByTestId('bar-c'), 5, 6);
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('Control+y');
    await interval(page.getByTestId(`bar-${id}`), final, final + 1);
    await interval(
      page.getByTestId('bar-b'),
      right ? final + 1 : final - 1,
      right ? final + 2 : final,
    );
  });
}

for (const outbound of ['right', 'left'] as const) {
  test(`overtaking ${outbound}, reversing, and holding pushes the overtaken bar from its other side`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Separated');
    await zoomToWeekZero(page);
    await pauseClock(page);
    const lane = await laneGeometry(page);
    const right = outbound === 'right';
    const id = right ? 'a' : 'c';
    const pickup = await beginBarDrag(page, id);
    const originalStart = right ? 0 : 5;
    await page.mouse.move(
      pickup.x + ((right ? 3 : 1) - originalStart) * lane.width,
      pickup.y,
    );
    await interval(page.getByTestId(`bar-${id}`), right ? 3 : 1, right ? 4 : 2);
    await interval(page.getByTestId('bar-b'), 2, 3);
    await page.mouse.move(
      pickup.x + (2 - originalStart) * lane.width,
      pickup.y,
    );
    const attached = (await page.getByTestId(`bar-${id}`).boundingBox())!;
    await page.clock.runFor(299);
    await expect(page.getByTestId('snap-preview')).toHaveAttribute(
      'data-valid',
      'false',
    );
    await interval(page.getByTestId('bar-b'), 2, 3);
    await page.clock.runFor(1);
    await interval(page.getByTestId('bar-b'), right ? 1 : 3, right ? 2 : 4);
    expect((await page.getByTestId(`bar-${id}`).boundingBox())!.x).toBeCloseTo(
      attached.x,
      0,
    );
    await page.mouse.up();
    await interval(page.getByTestId(`bar-${id}`), 2, 3);
    await page.keyboard.press('Control+z');
    await interval(
      page.getByTestId(`bar-${id}`),
      originalStart,
      originalStart + 1,
    );
    await interval(page.getByTestId('bar-b'), 2, 3);
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('Control+y');
    await interval(page.getByTestId(`bar-${id}`), 2, 3);
    await interval(page.getByTestId('bar-b'), right ? 1 : 3, right ? 2 : 4);
  });
}

for (const direction of ['right', 'left'] as const) {
  for (const escape of [true, false]) {
    test(`${direction} push: fast ${escape ? 'continuation restores neighbors while overtaking' : 'retraction carries the chain back'}`, async ({
      page,
    }) => {
      await page.goto('/tests/fixtures/index.html?state=Separated');
      await zoomToWeekZero(page);
      await pauseClock(page);
      const lane = await laneGeometry(page);
      const right = direction === 'right';
      const id = right ? 'a' : 'c';
      const origin = right ? 0 : 5;
      const pickup = await beginBarDrag(page, id);
      const moveTo = async (start: number) =>
        page.mouse.move(pickup.x + (start - origin) * lane.width, pickup.y);
      await moveTo(2);
      await page.clock.runFor(300);
      await page.clock.runFor(500);
      await moveTo(right ? 4 : 1);
      const displaced = right ? 5 : 0;
      await interval(page.getByTestId('bar-b'), displaced, displaced + 1);
      await page.clock.runFor(50);
      if (escape) {
        await moveTo(displaced); // Fast forward releases the push; another original bar still overlaps.
        await interval(page.getByTestId('bar-b'), 2, 3);
        await expect(page.getByTestId('snap-preview')).toHaveAttribute(
          'data-valid',
          'false',
        );
        await page.clock.runFor(10);
        await moveTo(right ? 8 : -2);
        await interval(page.getByTestId('bar-b'), 2, 3);
        await expect(page.getByTestId('snap-preview')).toHaveAttribute(
          'data-valid',
          'true',
        );
      } else {
        await moveTo(right ? 3 : 2);
        await interval(page.getByTestId('bar-b'), right ? 4 : 1, right ? 5 : 2);
        await expect(page.getByTestId('snap-preview')).toHaveAttribute(
          'data-valid',
          'true',
        );
      }
      const final = escape ? (right ? 8 : -2) : right ? 3 : 2;
      const finalB = escape ? 2 : right ? 4 : 1;
      await page.mouse.up();
      await interval(page.getByTestId(`bar-${id}`), final, final + 1);
      await interval(page.getByTestId('bar-b'), finalB, finalB + 1);
      await page.keyboard.press('Control+z');
      await interval(page.getByTestId('bar-a'), 0, 1);
      await interval(page.getByTestId('bar-b'), 2, 3);
      await interval(page.getByTestId('bar-c'), 5, 6);
      await expect(
        page.getByRole('button', { name: 'Undo', exact: true }),
      ).toBeDisabled();
      await page.keyboard.press('Control+y');
      await interval(page.getByTestId(`bar-${id}`), final, final + 1);
      await interval(page.getByTestId('bar-b'), finalB, finalB + 1);
    });
  }
}

for (const direction of ['right', 'left'] as const) {
  test(`passing ${direction} at a moderate pace swaps order without pushing crossed bars`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Chain');
    await zoomToWeekZero(page);
    await pauseClock(page);
    const lane = await laneGeometry(page);
    const id = direction === 'right' ? 'a' : 'c';
    const pickup = await beginBarDrag(page, id);
    const sign = direction === 'right' ? 1 : -1;
    for (const distance of [1, 2, 3]) {
      await page.mouse.move(pickup.x + sign * distance * lane.width, pickup.y);
      await page.clock.runFor(80);
      await expect(page.getByTestId('snap-preview')).toHaveAttribute(
        'data-valid',
        'false',
      );
      await interval(page.getByTestId('bar-b'), 2, 4);
    }
    await page.mouse.move(pickup.x + sign * 5 * lane.width, pickup.y);
    await expect(page.getByTestId('snap-preview')).toHaveAttribute(
      'data-valid',
      'true',
    );
    await page.mouse.up();
    await interval(
      page.getByTestId(`bar-${id}`),
      direction === 'right' ? 5 : -1,
      direction === 'right' ? 7 : 0,
    );
    await interval(page.getByTestId('bar-b'), 2, 4);
    await interval(
      page.getByTestId(`bar-${direction === 'right' ? 'c' : 'a'}`),
      direction === 'right' ? 4 : 0,
      direction === 'right' ? 5 : 2,
    );
    await page.keyboard.press('Control+z');
    await interval(page.getByTestId('bar-a'), 0, 2);
    await interval(page.getByTestId('bar-c'), 4, 5);
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('Control+y');
    await interval(
      page.getByTestId(`bar-${id}`),
      direction === 'right' ? 5 : -1,
      direction === 'right' ? 7 : 0,
    );
  });
}

test('a stationary pointer waits exactly 300ms, then the whole cascade activates and commits atomically', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await zoomToWeekZero(page);
  await pauseClock(page);
  const lane = await laneGeometry(page);
  const bar = page.getByTestId('bar-a');
  const before = (await bar.boundingBox())!;
  const pickup = await beginBarDrag(page, 'a');
  const distance = Math.round(lane.width);
  await page.mouse.move(pickup.x + distance, pickup.y);
  const tracking = (await bar.boundingBox())!;
  expect(tracking.x - before.x).toBeCloseTo(distance, 0);
  expect(await bar.evaluate((element) => element.getAnimations().length)).toBe(
    0,
  );
  await expect(bar).toHaveClass(/invalid/);
  await page.clock.runFor(299);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await interval(page.getByTestId('bar-b'), 2, 4);
  await interval(page.getByTestId('bar-c'), 4, 5);
  await page.clock.runFor(1);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'true',
  );
  await expect(bar).not.toHaveClass(/invalid/);
  await interval(page.getByTestId('bar-b'), 3, 5);
  await interval(page.getByTestId('bar-c'), 5, 6);
  expect((await bar.boundingBox())!.x).toBeCloseTo(tracking.x, 0);
  await page.mouse.up();
  await page.keyboard.press('Control+z');
  await interval(page.getByTestId('bar-a'), 0, 2);
  await interval(page.getByTestId('bar-b'), 2, 4);
  await interval(page.getByTestId('bar-c'), 4, 5);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Control+y');
  await interval(page.getByTestId('bar-a'), 1, 3);
  await interval(page.getByTestId('bar-b'), 3, 5);
  await interval(page.getByTestId('bar-c'), 5, 6);
});

test('retracting clear reverses an activated push and returning starts a fresh delay', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Separated');
  await zoomToWeekZero(page);
  await pauseClock(page);
  const lane = await laneGeometry(page);
  const pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x + 2 * lane.width, pickup.y);
  await page.clock.runFor(300);
  await interval(page.getByTestId('bar-b'), 3, 4);
  await page.mouse.move(pickup.x + lane.width, pickup.y);
  await interval(page.getByTestId('bar-b'), 2, 3);
  await page.mouse.move(pickup.x + 2 * lane.width, pickup.y);
  await page.clock.runFor(299);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await interval(page.getByTestId('bar-b'), 2, 3);
  await page.clock.runFor(1);
  await interval(page.getByTestId('bar-b'), 3, 4);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await interval(page.getByTestId('bar-a'), 0, 1);
  await interval(page.getByTestId('bar-c'), 5, 6);
});

for (const ending of ['release', 'Escape', 'cancel', 'capture', 'blur']) {
  test(`${ending} clears a pending push timer and preserves the document and redo`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Chain');
    await zoomToWeekZero(page);
    // Retain a real redo entry while testing cancellation of a different action.
    await page.getByTestId('bar-c').click();
    await page.keyboard.press('Delete');
    await page.keyboard.press('Control+z');
    await settled(page.getByTestId('bar-a'));
    await pauseClock(page);
    const lane = await laneGeometry(page);
    const pickup = await beginBarDrag(page, 'a');
    await page.mouse.move(pickup.x + lane.width, pickup.y);
    await page.clock.runFor(299);
    await expect(page.getByTestId('snap-preview')).toHaveAttribute(
      'data-valid',
      'false',
    );
    if (ending === 'Escape') await page.keyboard.press('Escape');
    else if (ending === 'cancel')
      await page.getByTestId('lane').dispatchEvent('pointercancel');
    else if (ending === 'blur')
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else if (ending === 'capture')
      await page.getByTestId('bar-a').evaluate((element) => {
        for (let id = 0; id < 10; id++)
          if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      });
    await page.mouse.up();
    await page.clock.runFor(500);
    await interval(page.getByTestId('bar-a'), 0, 2);
    await interval(page.getByTestId('bar-b'), 2, 4);
    await interval(page.getByTestId('bar-c'), 4, 5);
    await expect(page.getByTestId('snap-preview')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Redo', exact: true }),
    ).toBeEnabled();
    await page.keyboard.press('Control+y');
    await expect(page.getByTestId('bar-c')).toHaveCount(0);
  });
}

test('edge scrolling advances the proposal without restarting the same-neighbor delay', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=EdgeContact');
  await zoomToWeekZero(page);
  await pauseClock(page);
  const lane = await laneGeometry(page);
  await beginBarDrag(page, 'a');
  await page.mouse.move(lane.x(10) - 8, lane.y);
  await page.clock.runFor(299);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await interval(page.getByTestId('bar-b'), 8, 16);
  expect(
    Number(await page.getByTestId('lane').getAttribute('data-first-week')),
  ).toBeGreaterThan(-2);
  await page.clock.runFor(1);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'true',
  );
  expect(
    Number(await page.getByTestId('bar-b').getAttribute('data-start')),
  ).toBeGreaterThan(8);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await interval(page.getByTestId('bar-a'), 0, 1);
  await interval(page.getByTestId('bar-b'), 8, 16);
});

test('native horizontal scrolling and edge scrolling keep labels pinned and the visible timeline edge clear', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await zoomToWeekZero(page);
  const labels = page.locator('.lane-heading, .section-label, .row-label');
  const original = await labels.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().x),
  );
  const viewport = page.getByRole('region', { name: 'Whole-week Gantt chart' });
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(3), lane.y);
  await page.mouse.wheel(240, 0);
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(200);
  expect(
    await labels.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().x),
    ),
  ).toEqual(original);
  const rowLabel = (await page.locator('.row-label').boundingBox())!;
  await pauseClock(page);
  const pickup = await beginBarDrag(page, 'c');
  await page.mouse.move(rowLabel.x + rowLabel.width + 8, pickup.y);
  await page.clock.runFor(400);
  expect(
    Number(await page.getByTestId('lane').getAttribute('data-first-week')),
  ).toBeLessThan(-2);
  expect(
    await labels.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().x),
    ),
  ).toEqual(original);
  const target = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('.bar, .snap-preview'),
    { x: rowLabel.x + rowLabel.width - 12, y: pickup.y },
  );
  expect(target).toBeNull();
  await page.keyboard.press('Escape');
  await page.mouse.up();
});
