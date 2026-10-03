import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  draw,
  expectPosition,
  interval,
  laneGeometry,
  settled,
} from '../helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
});

test('a click and sub-threshold jitter create nothing; drawing either way keeps Week 0 fixed', async ({
  page,
}) => {
  const lane = await laneGeometry(page);
  await page.mouse.click(lane.x(3), lane.y);
  await page.mouse.move(lane.x(3), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(3) + 3, lane.y);
  await page.mouse.up();
  await expect(page.locator('.bar')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await draw(page, 3, 5);
  await interval(page.locator('.bar'), 3, 5);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByText('Drag to create a bar · Double-click for a milestone.'),
  ).toBeVisible();
  await draw(page, 5, 3);
  await interval(page.locator('.bar'), 3, 5);
  await expect(page.getByText('Week 0', { exact: true })).toBeVisible();
});

test('creation and inline naming are separate undo entries; Ctrl+Y restores both', async ({
  page,
}) => {
  await draw(page, 0, 2, 'Research');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.bar span')).toHaveText('');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.bar')).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await interval(page.locator('.bar'), 0, 2);
  await expect(page.locator('.bar span')).toHaveText('');
  await page.keyboard.press('Control+y');
  await expect(page.locator('.bar span')).toHaveText('Research');
});

test('drawing starts at four pixels and has a one-week minimum', async ({
  page,
}) => {
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(3), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(3) + 4, lane.y);
  await page.mouse.up();
  await expect(page.getByRole('textbox', { name: 'Bar name' })).toBeFocused();
  await interval(page.locator('.bar'), 3, 4);
});

test('naming commits on blur; Escape restores an existing name and text shortcuts stay in the input', async ({
  page,
}) => {
  await draw(page, 0, 2, 'Research');
  await page.locator('.bar').dblclick();
  const input = page.getByRole('textbox', { name: 'Bar name' });
  await expect(input).toBeFocused();
  await input.fill('Draft');
  await input.press('Control+z');
  await expect(page.locator('.bar')).toHaveCount(1);
  await input.fill('Changed');
  await input.press('Escape');
  await expect(page.locator('.bar span')).toHaveText('Research');
  await page.locator('.bar').dblclick();
  await input.fill('Planning');
  await page.getByText('Takt', { exact: false }).first().click();
  await expect(page.locator('.bar span')).toHaveText('Planning');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.bar span')).toHaveText('Research');
});

test('draw previews push a chain right, reverse completely, and Escape creates no action', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(-1), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(3), lane.y);
  await interval(page.getByTestId('bar-a'), 3, 5);
  await interval(page.getByTestId('bar-b'), 5, 7);
  await interval(page.getByTestId('bar-c'), 7, 8);
  await page.mouse.move(lane.x(0), lane.y);
  await interval(page.getByTestId('bar-a'), 0, 2);
  await interval(page.getByTestId('bar-b'), 2, 4);
  await page.mouse.move(lane.x(3), lane.y);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.bar')).toHaveCount(3);
  await expectPosition(page, 'a', 0, 2);
  await expectPosition(page, 'b', 2, 4);
  await expectPosition(page, 'c', 4, 5);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('textbox')).toHaveCount(0);
});

test('creation commits all rightward pushes and its own undo restores the entire row', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await draw(page, -1, 1);
  await expectPosition(page, 'a', 1, 3);
  await expectPosition(page, 'b', 3, 5);
  await expectPosition(page, 'c', 5, 6);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.bar')).toHaveCount(3);
  await expectPosition(page, 'a', 0, 2);
  await expectPosition(page, 'b', 2, 4);
  await expectPosition(page, 'c', 4, 5);
  await page.keyboard.press('Control+y');
  await expect(page.locator('.bar')).toHaveCount(4);
  await expectPosition(page, 'c', 5, 6);
});

test('moving by the label previews and reverses right and left cascades with atomic undo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const lane = await laneGeometry(page);
  const from = await beginBarDrag(page, 'a');
  await page.mouse.move(from.x + lane.width, from.y);
  await interval(page.getByTestId('bar-b'), 3, 5);
  await interval(page.getByTestId('bar-c'), 5, 6);
  await page.mouse.move(from.x, from.y);
  await interval(page.getByTestId('bar-b'), 2, 4);
  await page.mouse.move(from.x + lane.width, from.y);
  await page.mouse.up();
  await expectPosition(page, 'a', 1, 3);
  await expectPosition(page, 'b', 3, 5);
  await expectPosition(page, 'c', 5, 6);
  await page.keyboard.press('Control+z');
  await expectPosition(page, 'a', 0, 2);
  await expectPosition(page, 'c', 4, 5);
  await page.keyboard.press('Control+Shift+z');
  await expectPosition(page, 'c', 5, 6);
  await page.keyboard.press('Control+z');
  await settled(page.getByTestId('bar-c'));
  const left = await beginBarDrag(page, 'c');
  await page.mouse.move(left.x - lane.width, left.y);
  await page.mouse.up();
  await expectPosition(page, 'a', -1, 1);
  await expectPosition(page, 'b', 1, 3);
  await expectPosition(page, 'c', 3, 4);
});

test('both resize edges preserve the opposite edge and stop at the one-week minimum', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const lane = await laneGeometry(page);
  let from = await beginBarDrag(page, 'a', 'right');
  await page.mouse.move(from.x - 3 * lane.width, from.y);
  await page.mouse.up();
  await expectPosition(page, 'a', 0, 1);
  await page.keyboard.press('Control+z');
  await settled(page.getByTestId('bar-a'));
  from = await beginBarDrag(page, 'a', 'left');
  await page.mouse.move(from.x + 3 * lane.width, from.y);
  await page.mouse.up();
  await expectPosition(page, 'a', 1, 2);
  await page.keyboard.press('Control+z');
  await settled(page.getByTestId('bar-c'));
  from = await beginBarDrag(page, 'c', 'left');
  await page.mouse.move(from.x - lane.width, from.y);
  await page.mouse.up();
  await expectPosition(page, 'a', -1, 1);
  await expectPosition(page, 'b', 1, 3);
  await expectPosition(page, 'c', 3, 5);
});

test('real pointer proposals resolve exact halfway ties toward the later boundary', async ({
  page,
}) => {
  // An integral 82px week width avoids platform subpixel input quantization at the tie.
  await page.setViewportSize({ width: 1272, height: 800 });
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const lane = await laneGeometry(page);
  expect(lane.width).toBe(82);
  await settled(page.getByTestId('bar-a'));
  const from = await beginBarDrag(page, 'a');
  await page.mouse.move(from.x - lane.width / 2, from.y);
  await interval(page.getByTestId('snap-preview'), 0, 2);
  await page.mouse.move(from.x + lane.width / 2, from.y);
  await interval(page.getByTestId('snap-preview'), 1, 3);
  await page.mouse.up();
  await expectPosition(page, 'a', 1, 3);
  await page.keyboard.press('Control+z');
  await settled(page.getByTestId('bar-a'));
  const edge = await beginBarDrag(page, 'a', 'right');
  await page.mouse.move(edge.x + lane.width / 2, edge.y);
  await interval(page.getByTestId('snap-preview'), 0, 3);
  await page.mouse.up();
  await expectPosition(page, 'a', 0, 3);
});

test('extend, push, retract, and release commits only the last displayed preview', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const lane = await laneGeometry(page);
  const from = await beginBarDrag(page, 'a', 'right');
  await page.mouse.move(from.x + 2 * lane.width, from.y);
  await interval(page.getByTestId('bar-b'), 4, 6);
  await interval(page.getByTestId('bar-c'), 6, 7);
  await page.mouse.move(from.x + lane.width, from.y);
  await interval(page.getByTestId('snap-preview'), 0, 3);
  await page.mouse.up();
  await expectPosition(page, 'a', 0, 3);
  await expectPosition(page, 'b', 3, 5);
  await expectPosition(page, 'c', 5, 6);
  await page.keyboard.press('Control+z');
  await expectPosition(page, 'b', 2, 4);
  await expectPosition(page, 'c', 4, 5);
  await page.keyboard.press('Control+y');
  await expectPosition(page, 'b', 3, 5);
  await expectPosition(page, 'c', 5, 6);
});

test('pointer capture allows an outside release; pointer loss and window blur cancel', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const lane = await laneGeometry(page);
  const from = await beginBarDrag(page, 'a');
  await page.mouse.move(from.x + lane.width, from.y - 90);
  await page.mouse.up();
  await expectPosition(page, 'a', 1, 3);
  await page.keyboard.press('Control+z');
  await settled(page.getByTestId('bar-a'));
  for (const interruption of ['capture', 'cancel', 'blur']) {
    const start = await beginBarDrag(page, 'a');
    await page.mouse.move(start.x + lane.width, start.y);
    await interval(page.getByTestId('bar-b'), 3, 5);
    if (interruption === 'blur')
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else if (interruption === 'cancel')
      await page.getByTestId('lane').dispatchEvent('pointercancel');
    else
      await page.getByTestId('bar-a').evaluate((element) => {
        // The gesture began with real pointer input; force the interruption that is hard to induce externally.
        const lane = element as HTMLElement;
        for (let id = 0; id < 10; id++)
          if (lane.hasPointerCapture(id)) lane.releasePointerCapture(id);
      });
    await page.mouse.up();
    await expectPosition(page, 'a', 0, 2);
    await expectPosition(page, 'b', 2, 4);
    await expectPosition(page, 'c', 4, 5);
  }
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
});

test('selection clears on empty clicks, deletion is undoable, and narrow bars retain handles', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Narrow');
  const bar = page.getByTestId('bar-a');
  await expect(bar).toHaveAttribute('title', /A long label/);
  const lane = await laneGeometry(page);
  await bar.click();
  await page.mouse.click(lane.x(0), lane.y);
  await page.keyboard.press('Delete');
  await expect(bar).toBeVisible();
  await bar.click();
  await page.keyboard.press('Delete');
  await expect(bar).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expectPosition(page, 'a', 3, 4);
  const from = await beginBarDrag(page, 'a', 'right');
  await page.mouse.move(from.x + lane.width, from.y);
  await page.mouse.up();
  await expectPosition(page, 'a', 3, 5);
});
