import { test, expect } from '@playwright/test';
import { chooseZoom, interval, laneGeometry, pauseClock } from '../helpers';

for (const action of ['create', 'rename'] as const) {
  test(`overview ${action} animates into a readable, fully visible name field`, async ({
    page,
  }) => {
    await page.goto(
      `/tests/fixtures/index.html?state=${action === 'create' ? 'Empty' : 'ShortBars'}`,
    );
    await chooseZoom(page, '0.125');
    await pauseClock(page);
    const initial = await laneGeometry(page);
    let start = 0;
    if (action === 'create') {
      start =
        Math.ceil(
          Number(
            await page
              .getByTestId('lane')
              .first()
              .getAttribute('data-first-week'),
          ),
        ) + 1;
      await page.mouse.move(initial.x(start), initial.y);
      await page.mouse.down();
      await page.mouse.move(initial.x(start + 1), initial.y);
      await page.mouse.up();
    } else {
      await page.getByTestId('bar-short-2').click({ button: 'right' });
      await page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
    }
    const input = page.getByRole('textbox', { name: 'Bar name' });
    await expect(input).toBeFocused();
    await expect(page.locator('.viewport')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await page.clock.runFor(48);
    expect((await laneGeometry(page)).width).toBeGreaterThan(initial.width);
    expect((await laneGeometry(page)).width).toBeLessThan(initial.width * 16);
    await page.clock.runFor(160);
    await expect(page.locator('.viewport')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    const bar =
      action === 'create'
        ? page.locator('.bar')
        : page.getByTestId('bar-short-2');
    const bounds = (await bar.boundingBox())!;
    const viewport = (await page.locator('.viewport').boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(viewport.x + 218);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      viewport.x + viewport.width,
    );
    expect((await input.boundingBox())!.width).toBeGreaterThan(40);
    await expect(input).toBeFocused();
    await input.fill('Readable');
    await input.press('Enter');
    await interval(bar, start, start + 1);
    await expect(bar.locator('span')).toHaveText('Readable');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(bar).toHaveAttribute(
      'title',
      new RegExp(action === 'create' ? 'Unnamed bar' : 'Workshop'),
    );
    await expect(
      page.getByRole('combobox', { name: 'Zoom', exact: true }),
    ).toHaveText('200%');
    if (action === 'create') {
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(bar).toHaveCount(0);
    }
  });
}

test('clicking a tiny bar animates anchored zoom over 150 ms and preserves its weeks and redo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=ShortBars');
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('textbox', { name: 'Section name' }).press('Escape');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await chooseZoom(page, '0.125');
  await pauseClock(page);
  const bar = page.getByTestId('bar-short-2');
  await expect(bar.locator('span')).toHaveCount(0);
  await expect(bar.locator('.left')).toBeHidden();
  await expect(page.getByTestId('bar-mixed-3').locator('span')).toHaveCount(0);
  await expect(page.getByTestId('bar-mixed-3').locator('.left')).toBeVisible();
  await expect(bar).toHaveAttribute(
    'title',
    'Workshop · 5 Oct 2026–11 Oct 2026',
  );
  const box = (await bar.boundingBox())!;
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  const initial = await laneGeometry(page);
  const first = Number(
    await page.getByTestId('lane').first().getAttribute('data-first-week'),
  );
  const anchorWeek = first + (x - initial.x(first)) / initial.width;
  const labels = (await page.locator('.row-label').first().boundingBox())!;
  await page.mouse.click(x, y);
  await expect(page.locator('.viewport')).toHaveAttribute('aria-busy', 'true');
  expect((await laneGeometry(page)).width).toBe(initial.width);
  for (const elapsed of [48, 48]) {
    await page.clock.runFor(elapsed);
    const current = await laneGeometry(page);
    expect(current.width).toBeGreaterThan(initial.width);
    expect(current.width).toBeLessThan(initial.width * 16);
    expect(current.x(anchorWeek)).toBeCloseTo(x, 0);
    expect((await page.locator('.row-label').first().boundingBox())!.x).toBe(
      labels.x,
    );
    expect(await bar.evaluate((node) => node.getAnimations().length)).toBe(0);
  }
  await page.clock.runFor(48);
  await expect(page.locator('.viewport')).toHaveAttribute('aria-busy', 'true');
  await page.clock.runFor(64);
  await expect(page.locator('.viewport')).toHaveAttribute('aria-busy', 'false');
  await expect(
    page.getByRole('combobox', { name: 'Zoom', exact: true }),
  ).toHaveText('200%');
  await expect(bar.locator('span')).toHaveText('Workshop');
  await expect(bar.locator('.left')).toBeVisible();
  expect((await laneGeometry(page)).x(anchorWeek)).toBeCloseTo(x, 0);
  await interval(bar, 0, 1);
  await expect(page.getByTestId('snap-preview')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
});

for (const interruption of ['Escape', 'wheel', 'blur']) {
  test(`overview zoom stops cleanly after ${interruption} without a later jump or document change`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=ShortBars');
    await chooseZoom(page, '0.125');
    await pauseClock(page);
    const bar = page.getByTestId('bar-short-2');
    await bar.click();
    await page.clock.runFor(64);
    if (interruption === 'Escape') await page.keyboard.press('Escape');
    else if (interruption === 'blur')
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else {
      const box = (await bar.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + 14);
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, 80);
      await page.keyboard.up('Control');
    }
    const stopped = (await laneGeometry(page)).width;
    await page.clock.runFor(300);
    expect((await laneGeometry(page)).width).toBe(stopped);
    await expect(page.locator('.viewport')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await interval(bar, 0, 1);
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeDisabled();
  });
}
