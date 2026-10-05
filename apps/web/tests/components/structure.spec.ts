import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { pauseClock, settled, interval } from '../helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
});

test('six-dot handles drag rows and sections without a click entering naming', async ({
  page,
}) => {
  for (const name of ['Drag row Discovery', 'Drag section Research']) {
    const grip = page.getByRole('button', { name, exact: true });
    await expect(grip.locator('circle')).toHaveCount(6);
    await grip.click();
    await expect(page.getByRole('textbox')).toHaveCount(0);
  }
  const row = page.getByTestId('row-row-1');
  const destination = (await page.getByTestId('row-row-3').boundingBox())!;
  const rowGrip = (await page
    .getByRole('button', { name: 'Drag row Discovery', exact: true })
    .boundingBox())!;
  await page.mouse.move(
    rowGrip.x + rowGrip.width / 2,
    rowGrip.y + rowGrip.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    rowGrip.x + rowGrip.width / 2,
    destination.y + destination.height / 2 + 5,
  );
  await page.mouse.up();
  await expect(row).toHaveAttribute('data-section', 'section-2');
  await interval(page.getByTestId('bar-a'), 0, 2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(row).toHaveAttribute('data-section', 'section-1');
  await settled(row);
  const grip = (await page
    .getByRole('button', { name: 'Drag section Research', exact: true })
    .boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    grip.x + grip.width / 2,
    grip.y + grip.height / 2 + 360,
  );
  await page.mouse.up();
  expect((await sectionOrder(page)).at(-1)).toBe('section-1');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await sectionOrder(page))[0]).toBe('section-1');
});

async function pickup(page: Page, name: string) {
  const label = page.getByRole('button', { name, exact: true });
  const bounds = (await label.boundingBox())!;
  const point = {
    x: Math.round(bounds.x + 20),
    y: Math.round(bounds.y + bounds.height / 2),
  };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return point;
}
async function sectionOrder(page: Page) {
  return page
    .locator('[data-section-heading]')
    .evaluateAll((elements) =>
      elements
        .sort(
          (a, b) =>
            parseFloat((a as HTMLElement).style.top) -
            parseFloat((b as HTMLElement).style.top),
        )
        .map((element) => element.getAttribute('data-section-heading')),
    );
}
async function order(page: Page) {
  return page
    .locator('.row')
    .evaluateAll((rows) =>
      rows
        .sort(
          (a, b) =>
            parseFloat((a as HTMLElement).style.top) -
            parseFloat((b as HTMLElement).style.top),
        )
        .map((row) => row.getAttribute('data-testid')),
    );
}

test('row midpoints produce reversible previews, cancellation preserves redo, and a cross-section drop is atomic', async ({
  page,
}) => {
  // Seed a redo entry, then use view-only cancellation.
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('textbox', { name: 'Section name' }).press('Escape');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const second = (await page.getByTestId('row-row-2').boundingBox())!;
  const point = await pickup(page, 'Discovery');
  await page.mouse.move(point.x, second.y + second.height / 2 - 1);
  expect(await order(page)).toEqual([
    'row-row-1',
    'row-row-2',
    'row-row-3',
    'row-row-4',
  ]);
  await page.mouse.move(point.x, second.y + second.height / 2 + 1);
  expect(await order(page)).toEqual([
    'row-row-2',
    'row-row-1',
    'row-row-3',
    'row-row-4',
  ]);
  await page.mouse.move(point.x, point.y - 2);
  expect(await order(page)).toEqual([
    'row-row-1',
    'row-row-2',
    'row-row-3',
    'row-row-4',
  ]);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
  await settled(page.getByTestId('row-row-1'));
  const destination = (await page.getByTestId('row-row-3').boundingBox())!;
  await pickup(page, 'Discovery');
  await page.mouse.move(point.x, destination.y + destination.height / 2 + 5);
  await expect(page.getByTestId('row-row-1')).toHaveAttribute(
    'data-section',
    'section-2',
  );
  await page.mouse.up();
  await interval(page.getByTestId('bar-a'), 0, 2);
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'data-boundary',
    '5',
  );
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('row-row-1')).toHaveAttribute(
    'data-section',
    'section-1',
  );
  await page.keyboard.press('Control+y');
  await expect(page.getByTestId('row-row-1')).toHaveAttribute(
    'data-section',
    'section-2',
  );
});

test('a section moves all rows and items as one unit, supports reversal and one undo', async ({
  page,
}) => {
  const section = page.getByTestId('section-section-1');
  const original = (await section.boundingBox())!;
  const bar = page.getByTestId('bar-a');
  const barOriginal = (await bar.boundingBox())!;
  const milestone = page.getByTestId('milestone-m');
  const milestoneOriginal = (await milestone.boundingBox())!;
  const point = await pickup(page, 'Research');
  await page.mouse.move(point.x, point.y + 180);
  const held = (await section.boundingBox())!;
  expect(held.y).toBeCloseTo(original.y + 180, 0);
  expect((await bar.boundingBox())!.y).toBeCloseTo(barOriginal.y + 180, 0);
  expect((await milestone.boundingBox())!.y).toBeCloseTo(
    milestoneOriginal.y + 180,
    0,
  );
  await page.mouse.move(point.x, point.y);
  expect((await sectionOrder(page))[0]).toBe('section-1');
  await page.mouse.move(point.x, point.y + 360);
  await page.mouse.up();
  expect((await sectionOrder(page)).at(-1)).toBe('section-1');
  await page.keyboard.press('Control+z');
  expect((await sectionOrder(page))[0]).toBe('section-1');
  await page.keyboard.press('Control+y');
  expect((await sectionOrder(page)).at(-1)).toBe('section-1');
  await interval(bar, 0, 2);
});

test('dragging a collapsed section carries its heading and keeps every hidden row and item hidden', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Collapse Research', exact: true })
    .click();
  await settled(page.getByTestId('section-section-2'));
  const point = await pickup(page, 'Research');
  await page.mouse.move(point.x, point.y + 260);
  await expect(page.getByTestId('row-row-1')).toBeHidden();
  await expect(page.getByTestId('row-row-2')).toBeHidden();
  await expect(page.getByTestId('bar-a')).toBeHidden();
  await expect(page.getByTestId('milestone-m')).toBeHidden();
  await page.mouse.up();
  expect((await sectionOrder(page)).at(-1)).toBe('section-1');
  await expect(
    page.getByRole('button', { name: 'Expand Research', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('bar-a')).toBeHidden();
  await page
    .getByRole('button', { name: 'Expand Research', exact: true })
    .click();
  await expect(page.getByTestId('bar-a')).toBeVisible();
  await interval(page.getByTestId('bar-a'), 0, 2);
});

test('collapsed destinations expand after 500 ms, restore on leaving/cancel and stay expanded on a drop', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Collapse Delivery', exact: true })
    .click();
  await settled(page.getByTestId('section-section-2'));
  await pauseClock(page);
  const target = (await page.getByTestId('section-section-2').boundingBox())!;
  const point = await pickup(page, 'Discovery');
  await page.mouse.move(point.x, target.y + 18);
  await page.clock.runFor(499);
  await expect(
    page.getByRole('button', { name: 'Expand Delivery', exact: true }),
  ).toBeVisible();
  await page.clock.runFor(1);
  await expect(
    page.getByRole('button', { name: 'Collapse Delivery', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('row-row-1')).toHaveAttribute(
    'data-section',
    'section-2',
  );
  await page.mouse.move(point.x, point.y);
  await expect(
    page.getByRole('button', { name: 'Expand Delivery', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByTestId('row-row-1')).toHaveAttribute(
    'data-section',
    'section-1',
  );
  await page.clock.runFor(200);
  const targetAgain = (await page
    .getByTestId('section-section-2')
    .boundingBox())!;
  await pickup(page, 'Discovery');
  await page.mouse.move(point.x, targetAgain.y + 18);
  await page.clock.runFor(500);
  await page.mouse.up();
  await expect(
    page.getByRole('button', { name: 'Collapse Delivery', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('row-row-1')).toHaveAttribute(
    'data-section',
    'section-2',
  );
  await page
    .getByRole('button', { name: 'Collapse Delivery', exact: true })
    .click();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('row-row-1')).toHaveAttribute(
    'data-section',
    'section-1',
  );
  await page.keyboard.press('Control+y');
  await expect(
    page.getByRole('button', { name: 'Collapse Delivery', exact: true }),
  ).toBeVisible();
});

test('collapsed Add row expands, names separately, and hidden-content undo reveals the row', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Collapse Delivery', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Add row to Delivery', exact: true })
    .click();
  const input = page.getByRole('textbox', { name: 'Row name' });
  await expect(input).toBeFocused();
  await input.fill('QA');
  await input.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Collapse Delivery', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Collapse Delivery', exact: true })
    .click();
  await page.keyboard.press('Control+z');
  await expect(
    page.getByRole('button', { name: 'Collapse Delivery', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Unnamed row', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.row')).toHaveCount(4);
  await page.keyboard.press('Control+y');
  await expect(page.locator('.row')).toHaveCount(5);
});

test('container menus retain insertion locations and new sections start empty', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Review', exact: true })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Insert row above', exact: true })
    .click();
  const input = page.getByRole('textbox', { name: 'Row name' });
  await input.fill('Inserted');
  await input.press('Enter');
  const names = await page
    .locator('.row')
    .evaluateAll((elements) =>
      elements
        .sort(
          (a, b) =>
            parseFloat((a as HTMLElement).style.top) -
            parseFloat((b as HTMLElement).style.top),
        )
        .map((element) => element.querySelector('.row-name')!.textContent),
    );
  expect(names).toEqual([
    'Discovery',
    'Inserted',
    'Review',
    'Build',
    'Release',
  ]);
  await page
    .getByRole('button', { name: 'Research', exact: true })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Add section', exact: true })
    .click();
  const section = page.getByRole('textbox', { name: 'Section name' });
  await expect(section).toBeFocused();
  await section.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Unnamed section', exact: true }),
  ).toHaveText('Unnamed section');
  await expect(page.locator('.row')).toHaveCount(5);
  await page
    .getByRole('button', { name: 'Unnamed section', exact: true })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
  await section.fill('Planning');
  await section.press('Enter');
  await page.keyboard.press('Control+z');
  await expect(
    page.getByRole('button', { name: 'Unnamed section', exact: true }),
  ).toHaveText('Unnamed section');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.section')).toHaveCount(3);
});

for (const kind of ['row', 'section'] as const) {
  test(`${kind} deletion confirms its contents, cancels cleanly and restores every item with one undo`, async ({
    page,
  }) => {
    const name = kind === 'row' ? 'Discovery' : 'Research';
    await page
      .getByRole('button', { name, exact: true })
      .click({ button: 'right' });
    await page
      .getByRole('menuitem', { name: `Delete ${kind}…`, exact: true })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      kind === 'row'
        ? '1 bar and 1 milestone'
        : '2 rows, 2 bars and 1 milestone',
    );
    await expect(
      dialog.getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('bar-a')).toBeVisible();
    await page
      .getByRole('button', { name, exact: true })
      .click({ button: 'right' });
    await page
      .getByRole('menuitem', { name: `Delete ${kind}…`, exact: true })
      .click();
    await dialog
      .getByRole('button', { name: `Delete ${kind}`, exact: true })
      .click();
    await expect(page.getByTestId('bar-a')).toHaveCount(0);
    await expect(page.getByTestId('milestone-m')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('bar-a')).toBeVisible();
    await expect(page.getByTestId('milestone-m')).toBeVisible();
    await page.keyboard.press('Control+y');
    await expect(page.getByTestId('bar-a')).toHaveCount(0);
  });
}

test('empty containers still require confirmation and deleting the last row keeps its empty section usable', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await page
    .getByRole('button', { name: 'Unnamed row', exact: true })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Delete row…', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    '0 bars and 0 milestones',
  );
  await page.getByRole('button', { name: 'Delete row', exact: true }).click();
  await expect(page.locator('.row')).toHaveCount(0);
  await expect(page.locator('.section')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Unnamed section', exact: true })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Delete section…', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Delete section', exact: true })
    .click();
  await expect(page.locator('.section')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('textbox', { name: 'Section name' }).press('Escape');
  await page
    .getByRole('button', { name: 'Add row to Unnamed section', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'Row name' })).toBeFocused();
});

test('collapse clears hidden item selection and leaves redo intact; pointer loss restores structure', async ({
  page,
}) => {
  await page.getByTestId('bar-a').click();
  await page
    .getByRole('button', { name: 'Collapse Research', exact: true })
    .click();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('bar-a')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Expand Research', exact: true })
    .click();
  const point = await pickup(page, 'Discovery');
  await page.mouse.move(point.x, point.y + 70);
  await page
    .getByRole('button', { name: 'Discovery', exact: true })
    .dispatchEvent('lostpointercapture');
  await page.mouse.up();
  expect(await order(page)).toEqual([
    'row-row-1',
    'row-row-2',
    'row-row-3',
    'row-row-4',
  ]);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
});

test('structural edge scrolling follows a stationary pointer and stops on cancellation', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  await pauseClock(page);
  const viewport = page.getByRole('region', {
    name: 'Whole-week Gantt chart',
    exact: true,
  });
  const bounds = (await viewport.boundingBox())!;
  const point = await pickup(page, 'Lane 1');
  const y = Math.round(bounds.y + bounds.height - 2);
  await page.mouse.move(point.x, y);
  const carried = page.getByTestId('row-row-1');
  for (let i = 0; i < 10; i++) await page.clock.runFor(16);
  expect(
    await viewport.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(15);
  expect((await carried.boundingBox())!.y + 22).toBeCloseTo(y, 0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  const scroll = await viewport.evaluate((element) => element.scrollTop);
  await page.clock.runFor(200);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(scroll);
  await expect(carried).toHaveAttribute('data-section', 'section-1');
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
});

for (const kind of ['row', 'section'] as const) {
  test(`${kind} scrolling accelerates at both edges, stops outside the zone, and history reveals its destination`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=TallSections');
    // This scenario checks scrolling and final reveal geometry. Actual layout
    // transitions, including settlement, are inspected in structure-motion.
    await page.addStyleTag({
      content:
        '.row, .section, .add-row-line, .chart, .bar, .milestone { transition: none !important; }',
    });
    await pauseClock(page);
    const viewport = page.getByRole('region', {
      name: 'Whole-week Gantt chart',
      exact: true,
    });
    const bounds = await viewport.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top + element.clientTop + 54,
        bottom: rect.top + element.clientTop + element.clientHeight,
      };
    });
    const point = await pickup(page, kind === 'row' ? 'Lane 1' : 'Group 1');
    await page.mouse.move(point.x, bounds.bottom - 30);
    for (let i = 0; i < 5; i++) await page.clock.runFor(16);
    const slow = await viewport.evaluate((element) => element.scrollTop);
    await page.mouse.move(point.x, bounds.bottom - 4);
    for (let i = 0; i < 5; i++) await page.clock.runFor(16);
    const fast = await viewport.evaluate((element) => element.scrollTop);
    expect(slow).toBeGreaterThan(0);
    expect(fast - slow).toBeGreaterThan(slow * 2);
    await page.mouse.move(point.x, bounds.top + 100);
    const stopped = await viewport.evaluate((element) => element.scrollTop);
    await page.clock.runFor(160);
    expect(await viewport.evaluate((element) => element.scrollTop)).toBe(
      stopped,
    );
    await page.mouse.move(point.x, bounds.top + 4);
    for (let i = 0; i < 5; i++) await page.clock.runFor(16);
    expect(
      await viewport.evaluate((element) => element.scrollTop),
    ).toBeLessThan(stopped);
    await page.mouse.move(point.x, bounds.bottom - 4);
    for (let i = 0; i < 30; i++) await page.clock.runFor(16);
    for (let i = 0; i < 90; i++) await page.clock.runFor(80);
    const limit = await page
      .locator('.chart')
      .evaluate(
        (chart) =>
          parseFloat((chart as HTMLElement).style.height) -
          chart.parentElement!.clientHeight,
      );
    expect(await viewport.evaluate((element) => element.scrollTop)).toBeCloseTo(
      limit,
      0,
    );
    await page.clock.runFor(160);
    expect(await viewport.evaluate((element) => element.scrollTop)).toBeCloseTo(
      limit,
      0,
    );
    await page.mouse.up();
    await page.clock.runFor(200);
    const after = await viewport.evaluate((element) => element.scrollTop);
    await page.clock.runFor(160);
    expect(await viewport.evaluate((element) => element.scrollTop)).toBe(after);
    await page.keyboard.press('Control+z');
    await page.clock.runFor(200);
    const object = page.getByTestId(
      kind === 'row' ? 'row-row-1' : 'section-section-1',
    );
    expect((await object.boundingBox())!.y).toBeGreaterThanOrEqual(
      bounds.top - 1,
    );
    expect((await object.boundingBox())!.y).toBeLessThan(bounds.bottom);
    await page.keyboard.press('Control+y');
    await page.clock.runFor(200);
    expect((await object.boundingBox())!.y).toBeGreaterThanOrEqual(
      bounds.top - 1,
    );
    expect((await object.boundingBox())!.y).toBeLessThan(bounds.bottom);
  });
}
