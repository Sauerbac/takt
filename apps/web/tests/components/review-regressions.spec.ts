import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  interval,
  laneGeometry,
  pauseClock,
  settled,
} from '../helpers';

for (const scenario of ['creation', 'rename']) {
  test(`one-week ${scenario} keeps its name input inside the bar while long text scrolls`, async ({
    page,
  }) => {
    await page.goto(
      `/tests/fixtures/index.html?state=${scenario === 'creation' ? 'Empty' : 'Narrow'}`,
    );
    if (scenario === 'creation') {
      const lane = await laneGeometry(page);
      await page.mouse.move(lane.x(3), lane.y);
      await page.mouse.down();
      await page.mouse.move(lane.x(4), lane.y);
      await page.mouse.up();
    } else {
      await page.getByTestId('bar-a').click();
      await expect(page.locator('.viewport')).toHaveAttribute(
        'aria-busy',
        'false',
      );
      await page.getByTestId('bar-a').dblclick();
    }
    const input = page.getByRole('textbox', { name: 'Bar name' });
    await expect(input).toBeFocused();
    await expect(page.locator('.viewport')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    const bar = page.locator('.bar');
    await settled(bar);
    const bounds = (await bar.boundingBox())!,
      field = (await input.boundingBox())!;
    expect(field.x).toBeGreaterThanOrEqual(bounds.x + 10);
    expect(field.x + field.width).toBeLessThanOrEqual(
      bounds.x + bounds.width - 10,
    );
    const text = 'Planning with a name longer than the available bar';
    await input.fill(text);
    await expect(input).toHaveValue(text);
    // WebKit's native text scroller does not expose its offset as input.scrollLeft.
    // Verify keyboard caret placement and actual visible text in every engine instead.
    await input.press('ControlOrMeta+a');
    await input.press('ArrowLeft');
    expect(
      await input.evaluate(
        (element: HTMLInputElement) => element.selectionStart,
      ),
    ).toBe(0);
    const beginning = await input.screenshot({ caret: 'hide' });
    await input.press('ControlOrMeta+a');
    await input.press('ArrowRight');
    expect(
      await input.evaluate(
        (element: HTMLInputElement) => element.selectionStart,
      ),
    ).toBe(text.length);
    const ending = await input.screenshot({ caret: 'hide' });
    expect(ending.equals(beginning)).toBe(false);
    await input.press('Enter');
    await expect(bar).toHaveAttribute('title', new RegExp(text));
  });
}

test('double-clicking within a name input selects text without replacing the draft', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const bar = page.getByTestId('bar-a');
  await bar.dblclick();
  const input = page.getByRole('textbox', { name: 'Bar name' });
  await input.fill('Planning');
  await input.dblclick();
  await expect(input).toHaveValue('Planning');
  await input.press('Enter');
  await expect(bar.locator('span')).toHaveText('Planning');
  await page.keyboard.press('Control+z');
  await expect(bar.locator('span')).toHaveText('Research');
});

test('clicking blank viewport background clears selection without adding history', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const bar = page.getByTestId('bar-a');
  await bar.click();
  await expect(bar).toHaveClass(/selected/);
  const viewport = page.getByRole('region', { name: 'Whole-week Gantt chart' });
  const bounds = (await viewport.boundingBox())!;
  await page.mouse.click(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height - 30,
  );
  await expect(bar).not.toHaveClass(/selected/);
  await page.keyboard.press('Delete');
  await expect(page.locator('.bar')).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
});

test('dragged bars and their snapped previews cannot cover the row-name column', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await pauseClock(page);
  const lane = await laneGeometry(page);
  const from = await beginBarDrag(page, 'a');
  await page.mouse.move(from.x - lane.width * 2.4, from.y);
  const covered = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.closest('.bar, .snap-preview') !== null,
    { x: lane.x(-2) - 12, y: lane.y },
  );
  expect(covered).toBe(false);
  await interval(page.getByTestId('snap-preview'), -2, 0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await interval(page.getByTestId('bar-a'), 0, 2);
});
