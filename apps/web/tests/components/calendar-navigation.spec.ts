import { chooseZoom, zoomToWeekZero } from '../helpers';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { draw, interval, laneGeometry, settled, selectDate } from '../helpers';

const chart = (page: Page) =>
  page.getByRole('region', { name: 'Whole-week Gantt chart', exact: true });
async function chooseDate(page: Page, date: string) {
  await selectDate(page, date);
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function timeAt(page: Page, x: number) {
  const lane = await laneGeometry(page);
  return (
    Number(
      await page.getByTestId('lane').first().getAttribute('data-first-week'),
    ) +
    (x -
      lane.x(
        Number(
          await page
            .getByTestId('lane')
            .first()
            .getAttribute('data-first-week'),
        ),
      )) /
      lane.width
  );
}

test('calendar setup cancels cleanly, accepts user dates and preserves time/reference across undo and display changes', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  await zoomToWeekZero(page);
  const dates = page.getByRole('button', { name: 'Dates', exact: true });
  await dates.click();
  await expect(
    page.getByRole('grid').locator('button[tabindex="0"]'),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dates).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await dates.click();
  await chooseDate(page, '2026-10-07');
  await expect(page.locator('[data-week="0"]')).toHaveAccessibleName(
    '7 Oct 2026 · Set date for Week 0',
  );
  await expect(page.locator('[data-week="1"]')).toHaveAccessibleName(
    '14 Oct 2026 · Set date for Week 1',
  );
  await interval(page.getByTestId('bar-a'), 0, 2);
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'title',
    'Kickoff · 10 Nov 2026',
  );
  await page.locator('[data-week="3"]').click();
  await expect(
    page.getByRole('grid').locator('td[aria-selected="true"] button'),
  ).toHaveAttribute('data-date', '2026-10-28');
  await chooseDate(page, '2026-10-05');
  await expect(page.locator('[data-week="0"]')).toHaveAccessibleName(
    '14 Sept 2026 · Set date for Week 0',
  );
  await expect(page.getByTestId('bar-a')).toHaveAttribute(
    'title',
    'Discovery · 14 Sept 2026–27 Sept 2026',
  );
  await page.getByRole('button', { name: 'Weeks', exact: true }).click();
  await expect(page.locator('[data-week="3"]')).toHaveText('Week 3');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(dates).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-week="0"]')).toHaveAccessibleName(
    '7 Oct 2026 · Set date for Week 0',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(dates).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(dates).toHaveAttribute('aria-pressed', 'true');
  await interval(page.getByTestId('bar-a'), 0, 2);
});

test('a heading switches to Dates atomically; Escape/outside dismissal and empty drafts leave history untouched', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await zoomToWeekZero(page);
  const heading = page.locator('[data-week="3"]');
  await heading.click();
  await expect(
    page.getByRole('grid').locator('td[aria-selected="true"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Set date', exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(heading).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await heading.click();
  await page.mouse.click(10, 10);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await heading.click();
  await chooseDate(page, '2024-02-29');
  await expect(
    page.getByRole('button', { name: 'Weeks', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-week="3"]')).toHaveAccessibleName(
    '29 Feb 2024 · Set date for Week 3',
  );
  await expect(page.locator('[data-week="4"]')).toHaveAccessibleName(
    '7 Mar 2024 · Set date for Week 4',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.locator('[data-week="3"]').click();
  await chooseDate(page, '2024-02-29');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  // Saving an unchanged reference is a no-op, so Undo reverses the reference and display together.
  await expect(
    page.getByRole('button', { name: 'Weeks', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('toolbar and wheel zoom anchor time, clamp scale, and preserve redo with pinned labels after native scrolling', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('textbox', { name: 'Section name' }).press('Escape');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const bounds = (await chart(page).boundingBox())!;
  const center = (bounds.x + 218 + bounds.x + bounds.width) / 2;
  const initial = await timeAt(page, center);
  await chooseZoom(page, '2');
  expect(await timeAt(page, center)).toBeCloseTo(initial, 3);
  await chooseZoom(page, '0.5');
  expect(await timeAt(page, center)).toBeCloseTo(initial, 3);
  await page.setViewportSize({ width: 900, height: 800 });
  await chart(page).evaluate((node) => {
    node.scrollLeft = 180;
  });
  const label = (await page.locator('.row-label').boundingBox())!;
  const anchor = label.x + 218 + 180;
  const before = await timeAt(page, anchor);
  const lane = await laneGeometry(page);
  await page.mouse.move(anchor, lane.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -200);
  await expect
    .poll(async () => (await laneGeometry(page)).width)
    .toBeGreaterThan(lane.width);
  expect(await timeAt(page, anchor)).toBeCloseTo(before, 3);
  await page.mouse.wheel(0, -5000);
  await expect(
    page.getByRole('combobox', { name: 'Zoom', exact: true }),
  ).toHaveText('200%');
  expect(await timeAt(page, anchor)).toBeCloseTo(before, 3);
  await page.mouse.wheel(0, 5000);
  await expect(
    page.getByRole('combobox', { name: 'Zoom', exact: true }),
  ).toHaveText('12.5%');
  await page.keyboard.up('Control');
  expect((await page.locator('.row-label').boundingBox())!.x).toBeCloseTo(
    label.x,
    1,
  );
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
  await interval(page.getByTestId('bar-a'), 0, 2);
});

for (const scale of ['0.5', '2']) {
  test(`drawing, moving and resizing remain whole-week actions at ${Number(scale) * 100}%`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Empty');
    if (scale === '2') await zoomToWeekZero(page);
    else await chooseZoom(page, scale);
    // Zoom anchors the view center: pick a visible interval at both extremes.
    await draw(page, 2, 3, 'Work');
    const bar = page.locator('.bar');
    await expect(chart(page)).toHaveAttribute('aria-busy', 'false');
    await settled(bar);
    const before = (await bar.boundingBox())!;
    const lane = await laneGeometry(page);
    await page.mouse.move(before.x + before.width / 2, lane.y);
    await page.mouse.down();
    await page.mouse.move(
      before.x + before.width / 2 + lane.width * 0.6,
      lane.y,
    );
    await page.mouse.up();
    await interval(bar, 3, 4);
    await settled(bar);
    const handle = (await bar.locator('.right').boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, lane.y);
    await page.mouse.down();
    await page.mouse.move(
      handle.x + handle.width / 2 + lane.width * 1.1,
      lane.y,
    );
    await page.mouse.up();
    await interval(bar, 3, 5);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await interval(bar, 3, 4);
    await expect(
      page.getByRole('combobox', { name: 'Zoom', exact: true }),
    ).toHaveText('200%');
  });
}

test('Space-drag carries the view continuously, preserves redo and never draws or moves selected contents', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('textbox', { name: 'Section name' }).press('Escape');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await chart(page).evaluate((node) => {
    node.scrollTop = 120;
  });
  await chart(page).focus();
  const lane = await laneGeometry(page, 4);
  const start = Number(
    await page.getByTestId('lane').first().getAttribute('data-first-week'),
  );
  const row = (await page.locator('.row-label').nth(4).boundingBox())!;
  await page.keyboard.down('Space');
  await page.mouse.move(lane.x(4), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(4) + 120, lane.y + 50);
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('lane').first().getAttribute('data-first-week'),
      ),
    )
    .toBeCloseTo(start - 120 / lane.width, 3);
  expect(await chart(page).evaluate((node) => node.scrollTop)).toBe(70);
  expect((await page.locator('.row-label').nth(4).boundingBox())!.x).toBe(
    row.x,
  );
  await expect(page.getByTestId('snap-preview')).toHaveCount(0);
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect(page.locator('.bar')).toHaveCount(1);
  await interval(page.getByTestId('bar-a'), 0, 2);
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
  await chart(page).evaluate((node) => {
    node.scrollTop = 0;
  });
  await settled(page.getByTestId('bar-a'));
  const bar = (await page.getByTestId('bar-a').boundingBox())!;
  await chart(page).focus();
  await page.keyboard.down('Space');
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 14);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2 + 57, bar.y + 14);
  expect((await page.getByTestId('bar-a').boundingBox())!.x).toBeCloseTo(
    bar.x + 57,
    0,
  );
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.keyboard.up('Space');
  await interval(page.getByTestId('bar-a'), 0, 2);
  await expect(page.locator('.viewport')).not.toHaveClass(/panning/);
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
});

test('horizontal wheel scrolling moves time and keeps labels pinned; normal vertical wheel still scrolls rows', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  const label = (await page.locator('.row-label').first().boundingBox())!;
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(5), lane.y);
  await page.mouse.wheel(-600, 0);
  await expect
    .poll(async () =>
      Number(
        await page.getByTestId('lane').first().getAttribute('data-first-week'),
      ),
    )
    .toBeLessThan(-2);
  expect((await page.locator('.row-label').first().boundingBox())!.x).toBe(
    label.x,
  );
  await page.mouse.wheel(0, 200);
  await expect
    .poll(() => chart(page).evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
});

test('Space activates focused standard chart controls and remains text input while naming', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await page.locator('.section-name').focus();
  await page.keyboard.press('Space');
  const name = page.getByRole('textbox', { name: 'Section name', exact: true });
  await expect(name).toBeFocused();
  await name.press('Space');
  await expect(name).toHaveValue(' ');
  await name.press('Escape');
  const heading = page.locator('[data-week="0"]');
  await heading.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(heading).toBeFocused();
  await expect(page.locator('.viewport')).not.toHaveClass(/pannable/);
  const add = page.getByRole('button', { name: 'Add section', exact: true });
  await add.focus();
  await page.keyboard.press('Space');
  await expect(
    page.getByRole('textbox', { name: 'Section name', exact: true }),
  ).toBeFocused();
});
