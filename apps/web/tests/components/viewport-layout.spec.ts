import { test, expect } from '@playwright/test';
import {
  chooseZoom,
  draw,
  interval,
  laneGeometry,
  selectDate,
  settled,
  zoomToWeekZero,
} from '../helpers';

test('100% shows 24 weeks, 200% shows 12, and overview zoom shows 192', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  const lane = page.getByTestId('lane');
  for (const [zoom, visibleWeeks] of [
    ['1', 24],
    ['2', 12],
    ['0.125', 192],
  ] as const) {
    await chooseZoom(page, zoom);
    const count = await lane.evaluate(
      (node) => node.clientWidth / Number(node.dataset.weekWidth),
    );
    expect(count).toBeCloseTo(visibleWeeks, 6);
  }
});

test('chart fills the available window and freezes the top row and left column during both axes of scrolling', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  const header = page.locator('.chart-header');
  const corner = page.locator('.lane-heading');
  const top = (await header.boundingBox())!.y;
  const left = (await corner.boundingBox())!.x;
  const row = page.locator('.row-label').nth(8);
  const before = (await row.boundingBox())!;
  await page.locator('.viewport').evaluate((node) => {
    node.scrollTop = 200;
    node.scrollLeft = 120;
  });
  expect((await header.boundingBox())!.y).toBe(top);
  expect((await corner.boundingBox())!.x).toBe(left);
  expect((await corner.boundingBox())!.y).toBe(top);
  expect((await row.boundingBox())!.x).toBe(before.x);
  expect((await row.boundingBox())!.y).toBeCloseTo(before.y - 200, 0);
  const point = (await page.locator('.weeks').boundingBox())!;
  expect(
    await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.chart-header'),
      { x: left + 230, y: point.y + 25 },
    ),
  ).toBe(true);
  for (const size of [
    { width: 900, height: 600 },
    { width: 1600, height: 1000 },
  ]) {
    await page.setViewportSize(size);
    const viewport = (await page.locator('.viewport').boundingBox())!;
    const footer = (await page.locator('footer').boundingBox())!;
    expect(viewport.width).toBe(size.width - 68);
    expect(viewport.y + viewport.height).toBeCloseTo(footer.y, 0);
    expect(footer.y + footer.height).toBeCloseTo(size.height - 26, 0);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(size.height);
  }
});

test('overview creation stays weekly and tiny bars zoom into usable resize targets', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await chooseZoom(page, '0.125');
  await draw(page, 0, 4, 'Overview');
  const bar = page.locator('.bar');
  await expect(
    page.getByRole('combobox', { name: 'Zoom', exact: true }),
  ).toHaveText('200%');
  await expect(page.locator('.viewport')).toHaveAttribute('aria-busy', 'false');
  const lane = await laneGeometry(page);
  const handle = (await bar.locator('.right').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 14);
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 - lane.width * 3,
    handle.y + 14,
  );
  await page.mouse.up();
  await interval(bar, 0, 1);
  await settled(bar);
  expect((await bar.boundingBox())!.width).toBeGreaterThan(2);
  const left = (await bar.locator('.left').boundingBox())!;
  const right = (await bar.locator('.right').boundingBox())!;
  expect(left.x + left.width).toBeLessThanOrEqual(right.x);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await interval(bar, 0, 4);
  await expect(
    page.getByRole('combobox', { name: 'Zoom', exact: true }),
  ).toHaveText('200%');
});

test('overview switches between spaced weeks and actual month/year bands; reference menus retain the clicked week', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  await chooseZoom(page, '0.125');
  await expect(page.locator('.year-band')).toContainText([
    '2025',
    '2026',
    '2027',
  ]);
  await expect(page.locator('.month-band')).not.toHaveCount(0);
  const lane = await laneGeometry(page);
  await page.mouse.click(lane.x(3.2), 125, { button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Reset reference', exact: true })
    .click();
  await selectDate(page, '2026-10-12');
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await zoomToWeekZero(page);
  await expect(page.locator('[data-week="3"]')).toHaveAccessibleName(
    '12 Oct 2026 · Set date for Week 3',
  );
  await chooseZoom(page, '0.125');
  await page.getByRole('button', { name: 'Weeks', exact: true }).click();
  await expect(page.locator('.month-band')).toHaveCount(0);
  const headings = await page.locator('.week-label').evaluateAll((nodes) =>
    nodes.map((node) => ({
      week: Number((node.parentElement as HTMLElement).dataset.week),
      width: node.getBoundingClientRect().width,
    })),
  );
  expect(headings.every((heading) => heading.width >= 60)).toBe(true);
  expect(headings[1].week - headings[0].week).toBe(16);
  await page.locator('[data-week="0"]').click();
  await selectDate(page, '2026-10-05');
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await expect(page.locator('.viewport')).toBeFocused();
  await page.locator('.month-band').nth(2).click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Clear reference', exact: true })
    .click();
  await expect(page.locator('.viewport')).toBeFocused();
  await expect(page.locator('.month-band')).toHaveCount(0);
});
