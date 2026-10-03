import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  interval,
  laneGeometry,
  pauseClock,
  settled,
} from '../helpers';
import type { Page } from '@playwright/test';

test('the global empty hint follows the first visible row after native vertical scrolling', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=TallEmpty');
  const viewport = page.locator('.viewport');
  await viewport.evaluate((element) => {
    element.scrollTop = 500;
  });
  await expect(page.locator('.hint')).toHaveCount(1);
  await expect(page.locator('.hint')).toBeInViewport();
  await expect(page.getByTestId('lane').nth(9).locator('.hint')).toHaveCount(1);
});

for (const right of [true, false]) {
  test(`milestone ${right ? 'right' : 'left'} edge scrolling preserves pointer attachment and commits one history action`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=CrossRows');
    await pauseClock(page);
    const viewport = page.locator('.viewport'),
      bounds = (await viewport.boundingBox())!;
    const pickup = await beginMilestone(page),
      x = right ? bounds.x + bounds.width - 5 : bounds.x + 218 + 5;
    const target = page.getByTestId('milestone-m');
    const pickupOffset = pickup.x - (await target.boundingBox())!.x;
    await page.mouse.move(x, pickup.y);
    await page.clock.runFor(400);
    const firstWeek = Number(
      await page.getByTestId('lane').first().getAttribute('data-first-week'),
    );
    expect(right ? firstWeek > -2 : firstWeek < -2).toBe(true);
    const carried = (await target.boundingBox())!;
    expect(carried.x + pickupOffset).toBeCloseTo(x, 0);
    expect(
      await target.evaluate(
        (element) => getComputedStyle(element).transitionDuration,
      ),
    ).toBe('0s');
    const boundary = await target.getAttribute('data-boundary');
    await page.mouse.up();
    await page.clock.runFor(200);
    expect(
      Number(
        await page.getByTestId('lane').first().getAttribute('data-first-week'),
      ),
    ).toBe(firstWeek);
    await page.keyboard.press('Control+z');
    await expect(target).toHaveAttribute('data-boundary', '5');
    await page.keyboard.press('Control+y');
    await expect(target).toHaveAttribute('data-boundary', boundary!);
    await interval(page.getByTestId('bar-a'), 0, 2);
  });
}

async function beginMilestone(page: Page, id = 'm') {
  const box = (await page.getByTestId(`milestone-${id}`).boundingBox())!;
  const x = Math.round(box.x + 2),
    y = Math.round(box.y + box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y };
}

test('vertical-only bar movement restores each departed row and commits only the final cascade', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const second = await laneGeometry(page, 1),
    third = await laneGeometry(page, 2);
  const pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x, second.y);
  await interval(page.getByTestId('bar-b'), 2, 4);
  await interval(page.getByTestId('bar-c'), 4, 5);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-row',
    'row-2',
  );
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'true',
  );
  const carried = (await page.getByTestId('bar-a').boundingBox())!;
  expect(carried.y + carried.height / 2).toBeCloseTo(second.y, 0);
  await page.mouse.move(pickup.x, third.y);
  await interval(page.getByTestId('bar-b'), 0, 2);
  await interval(page.getByTestId('bar-c'), 2, 3);
  await interval(page.getByTestId('bar-d'), 2, 3);
  await page.mouse.up();
  await expect(page.getByTestId('bar-a')).toHaveAttribute('data-row', 'row-3');
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('bar-a')).toHaveAttribute('data-row', 'row-1');
  await interval(page.getByTestId('bar-d'), 0, 1);
  await page.keyboard.press('Control+y');
  await expect(page.getByTestId('bar-a')).toHaveAttribute('data-row', 'row-3');
  await interval(page.getByTestId('bar-d'), 2, 3);
  await expect(page.getByTestId('milestone-n')).toHaveAttribute(
    'data-boundary',
    '3',
  );
});

test('cross-row previews cancel on Escape, pointer interruption and window blur while preserving redo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const row = await laneGeometry(page, 1);
  let pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x, row.y);
  await page.mouse.up();
  await page.keyboard.press('Control+z');
  for (const reason of ['Escape', 'pointercancel', 'blur', 'capture']) {
    await settled(page.getByTestId('bar-a'));
    pickup = await beginBarDrag(page, 'a');
    await page.mouse.move(pickup.x, row.y);
    await interval(page.getByTestId('bar-c'), 4, 5);
    if (reason === 'Escape') await page.keyboard.press('Escape');
    else if (reason === 'pointercancel')
      await page.getByTestId('lane').first().dispatchEvent('pointercancel');
    else if (reason === 'blur')
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else
      await page.getByTestId('bar-a').evaluate((element) => {
        for (let id = 0; id < 10; id++)
          if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
      });
    await page.mouse.up();
    await expect(page.getByTestId('bar-a')).toHaveAttribute(
      'data-row',
      'row-1',
    );
    await interval(page.getByTestId('bar-b'), 0, 2);
    await interval(page.getByTestId('bar-c'), 2, 3);
    await expect(
      page.getByRole('button', { name: 'Redo', exact: true }),
    ).toBeEnabled();
  }
});

test('draw and resize remain in the pressed row when the pointer crosses rows', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const second = await laneGeometry(page, 1);
  const pickup = await beginBarDrag(page, 'a', 'right');
  await page.mouse.move(pickup.x + second.width, second.y);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-row',
    'row-1',
  );
  await interval(page.getByTestId('bar-b'), 0, 2);
  await page.mouse.up();
  await interval(page.getByTestId('bar-a'), 0, 3);
  await page.mouse.move(second.x(6), second.y);
  await page.mouse.down();
  const third = await laneGeometry(page, 2);
  await page.mouse.move(second.x(8), third.y);
  await page.mouse.up();
  await expect(page.getByRole('textbox', { name: 'Bar name' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Bar name' }).press('Escape');
  await expect(page.locator('.bar').last()).toHaveAttribute(
    'data-row',
    'row-2',
  );
});

test('double-click creates an end-of-week milestone with separate naming, text scope, deletion and undo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  const lane = await laneGeometry(page);
  await page.mouse.dblclick(lane.x(2.4), lane.y);
  const item = page.locator('.milestone');
  await expect(item).toHaveAttribute('data-boundary', '3');
  const input = page.getByRole('textbox', { name: 'Milestone name' });
  await expect(input).toBeFocused();
  await input.fill('Release');
  await input.press('Enter');
  await page.keyboard.press('Control+z');
  await expect(item.locator('span')).toHaveText('');
  await page.keyboard.press('Control+z');
  await expect(item).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+y');
  await expect(item.locator('span')).toHaveText('Release');
  const label = (await item.locator('span').boundingBox())!;
  await page.mouse.dblclick(
    label.x + label.width / 2,
    label.y + label.height / 2,
  );
  await input.fill('Draft');
  await input.press('Delete');
  await expect(item).toHaveCount(1);
  await input.press('Escape');
  await expect(item.locator('span')).toHaveText('Release');
  await page.keyboard.press('Backspace');
  await expect(item).toHaveCount(0);
  await expect(page.locator('.hint')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(item).toHaveCount(1);
  await expect(page.locator('.hint')).toHaveCount(0);
});

test('context creation retains the opened row and week; duplicate creation shows feedback without changing history', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const lane = await laneGeometry(page, 1);
  const laneBounds = (await page.getByTestId('lane').nth(1).boundingBox())!;
  await page.mouse.click(lane.x(2.3), laneBounds.y + 2, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Add milestone here' }).click();
  await expect(page.getByRole('status')).toHaveText(/already marks/);
  await expect(page.locator('.milestone')).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await page.mouse.click(lane.x(-0.7), lane.y, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Add milestone here' }).click();
  await page.getByRole('textbox', { name: 'Milestone name' }).press('Escape');
  await expect(page.locator('.milestone').last()).toHaveAttribute(
    'data-boundary',
    '0',
  );
  await expect(page.locator('.milestone').last()).toHaveAttribute(
    'data-row',
    'row-2',
  );
  // Open the bar command above an occupied time using the free edge of the lane.
  const bounds = (await page.getByTestId('lane').nth(1).boundingBox())!;
  await page.mouse.click(lane.x(0.3), bounds.y + 2, { button: 'right' });
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Bar name' }).press('Escape');
  await interval(page.locator('.bar').last(), 0, 1);
  await expect(page.locator('.bar').last()).toHaveAttribute(
    'data-row',
    'row-2',
  );
  await interval(page.getByTestId('bar-b'), 1, 3);
  await interval(page.getByTestId('bar-c'), 3, 4);
  await page.keyboard.press('Control+z');
  await interval(page.getByTestId('bar-b'), 0, 2);
});

test('milestones overlap bars without pushing, and duplicate cross-row drops cancel with redo intact', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const first = await laneGeometry(page),
    second = await laneGeometry(page, 1);
  let pickup = await beginMilestone(page);
  await page.mouse.move(pickup.x - 4 * first.width, pickup.y);
  await page.mouse.up();
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'data-boundary',
    '1',
  );
  await interval(page.getByTestId('bar-a'), 0, 2);
  await page.keyboard.press('Control+z');
  await settled(page.getByTestId('milestone-m'));
  pickup = await beginMilestone(page);
  await page.mouse.move(pickup.x - 2 * first.width, second.y);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await expect(page.getByTestId('milestone-m')).toHaveClass(/invalid/);
  await page.mouse.up();
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'data-boundary',
    '5',
  );
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'data-row',
    'row-1',
  );
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
  await settled(page.getByTestId('milestone-m'));
  pickup = await beginMilestone(page);
  await page.mouse.move(pickup.x, second.y);
  await page.mouse.up();
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'data-row',
    'row-2',
  );
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'data-boundary',
    '5',
  );
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'data-row',
    'row-1',
  );
  await page.keyboard.press('Control+y');
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'data-row',
    'row-2',
  );
});

test('duplicate double-click creation preserves the existing milestone and the redo stack', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  const lane = await laneGeometry(page);
  await page.mouse.dblclick(lane.x(2.2), lane.y);
  await page.getByRole('textbox', { name: 'Milestone name' }).fill('Saved');
  await page.getByRole('textbox', { name: 'Milestone name' }).press('Enter');
  await page.keyboard.press('Control+z');
  await page.mouse.dblclick(lane.x(2.7), lane.y);
  await expect(page.locator('.milestone')).toHaveCount(1);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText(/already marks/);
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
  await page.keyboard.press('Control+y');
  await expect(page.locator('.milestone span')).toHaveText('Saved');
});

test('Add row and naming have separate history, and the empty-document hint appears once', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await page.getByRole('button', { name: '+ Add row', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Row name' });
  await expect(input).toBeFocused();
  await input.fill('Design');
  await input.press('Enter');
  await expect(page.getByTestId('lane')).toHaveCount(2);
  await expect(page.locator('.hint')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(
    page.getByRole('button', { name: 'Unnamed row', exact: true }),
  ).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('lane')).toHaveCount(1);
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+y');
  const second = await laneGeometry(page, 1);
  await page.mouse.dblclick(second.x(1.4), second.y);
  await page.getByRole('textbox', { name: 'Milestone name' }).press('Escape');
  await expect(page.locator('.hint')).toHaveCount(0);
  await page.keyboard.press('Delete');
  await expect(page.locator('.hint')).toHaveCount(1);
});

for (const milestone of [false, true]) {
  test(`vertical edge scrolling carries a ${milestone ? 'milestone' : 'bar'} under a stationary pointer, stops on exit, and reveals undo/redo`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Tall');
    await pauseClock(page);
    const viewport = page.locator('.viewport'),
      bounds = (await viewport.boundingBox())!;
    const pickup = milestone
      ? await beginMilestone(page)
      : await beginBarDrag(page, 'a');
    const y = bounds.y + bounds.height - 5;
    await page.mouse.move(pickup.x, y);
    await page.clock.runFor(600);
    const scroll = await viewport.evaluate((element) => element.scrollTop);
    expect(scroll).toBeGreaterThan(100);
    const target = page.getByTestId(milestone ? 'milestone-m' : 'bar-a');
    const carried = (await target.boundingBox())!;
    expect(carried.y + carried.height / 2).toBeCloseTo(y, 0);
    const destination = await page
      .getByTestId('snap-preview')
      .getAttribute('data-row');
    expect(Number(destination!.slice(4))).toBeGreaterThan(9);
    await page.mouse.move(pickup.x, bounds.y + bounds.height + 20);
    const stopped = await viewport.evaluate((element) => element.scrollTop);
    await page.clock.runFor(200);
    expect(await viewport.evaluate((element) => element.scrollTop)).toBe(
      stopped,
    );
    await page.mouse.up();
    await expect(target).toHaveAttribute('data-row', destination!);
    await page.keyboard.press('Control+z');
    await expect(target).toHaveAttribute('data-row', 'row-1');
    expect(
      await viewport.evaluate((element) => element.scrollTop),
    ).toBeLessThan(100);
    await page.keyboard.press('Control+y');
    await expect(target).toHaveAttribute('data-row', destination!);
    expect(
      await viewport.evaluate((element) => element.scrollTop),
    ).toBeGreaterThan(100);
  });
}

test('vertical scrolling accelerates toward the edge, reverses upward, and cancellation preserves its view', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  await pauseClock(page);
  const viewport = page.locator('.viewport'),
    bounds = (await viewport.boundingBox())!;
  const pickup = await beginBarDrag(page, 'a');
  await page.mouse.move(pickup.x, bounds.y + bounds.height - 30);
  await page.clock.runFor(300);
  const slow = await viewport.evaluate((element) => element.scrollTop);
  await page.mouse.move(pickup.x, bounds.y + bounds.height - 3);
  await page.clock.runFor(300);
  const fast = await viewport.evaluate((element) => element.scrollTop);
  expect(fast - slow).toBeGreaterThan(slow * 2);
  await page.mouse.move(pickup.x, bounds.y + 3);
  await page.clock.runFor(100);
  const reversed = await viewport.evaluate((element) => element.scrollTop);
  expect(reversed).toBeLessThan(fast);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.clock.runFor(300);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(
    reversed,
  );
  await expect(page.getByTestId('bar-a')).toHaveAttribute('data-row', 'row-1');
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
});
