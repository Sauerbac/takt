import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  interval,
  laneGeometry,
  pauseClock,
  settled,
  chooseColor,
  chooseZoom,
} from '../helpers';

for (const id of ['a', 'b']) {
  test(`the snapped preview follows ${id === 'a' ? 'inherited' : 'overridden'} bar color`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=CalendarColors');
    const bar = page.getByTestId(`bar-${id}`);
    if (id === 'b') {
      await bar.click({ button: 'right' });
      await chooseColor(page, 'Slate');
    }
    await pauseClock(page);
    const pickup = await beginBarDrag(page, id);
    await page.mouse.move(pickup.x + 10, pickup.y);
    const preview = page.getByTestId('snap-preview');
    await expect(preview).toBeVisible();
    const color = await bar.evaluate((node) =>
      getComputedStyle(node).getPropertyValue('--bar-fill').trim(),
    );
    expect(
      await preview.evaluate((node) =>
        getComputedStyle(node).getPropertyValue('--bar-fill').trim(),
      ),
    ).toBe(color);
  });
}

test('a carried row hides other bars, milestones and grids beneath its surface', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  await pauseClock(page);
  const row = page.getByTestId('row-row-1');
  const bar = page.getByTestId('bar-a');
  const original = (await bar.boundingBox())!;
  const grip = (await page
    .getByRole('button', { name: 'Drag row Discovery', exact: true })
    .boundingBox())!;
  await page.mouse.move(grip.x + 5, grip.y + 12);
  await page.mouse.down();
  await page.mouse.move(grip.x + 5, grip.y + 12 + 30);
  expect((await bar.boundingBox())!.y).toBeCloseTo(original.y + 30, 0);
  const surface = page.locator('.carried-surface');
  await expect(surface).toBeVisible();
  await expect(surface).toHaveCSS('box-shadow', 'none');
  await expect(row).toHaveCSS('box-shadow', 'none');
  const rowBox = (await row.boundingBox())!;
  const lane = await laneGeometry(page);
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.className,
    { x: lane.x(10), y: rowBox.y + 22 },
  );
  expect(hit).toContain('carried-surface');
});

test('a carried section has one shadow at its bottom without shadows under the heading or interior rows', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  await pauseClock(page);
  const grip = (await page
    .getByRole('button', { name: 'Drag section Research', exact: true })
    .boundingBox())!;
  await page.mouse.move(grip.x + 5, grip.y + 12);
  await page.mouse.down();
  await page.mouse.move(grip.x + 5, grip.y + 42);
  for (const selector of [
    '.section.carried',
    '.row.carried',
    '.carried-surface',
  ]) {
    const surfaces = page.locator(selector);
    expect(await surfaces.count()).toBeGreaterThan(0);
    for (const surface of await surfaces.all())
      await expect(surface).toHaveCSS('box-shadow', 'none');
  }
  const bottom = page.locator('.add-row-line.carried');
  await expect(bottom).not.toHaveCSS('box-shadow', 'none');
  await expect(bottom).toHaveCSS('clip-path', 'inset(0px -12px -16px)');
  const bottomBox = (await bottom.boundingBox())!;
  const groupBox = (await page.locator('.section-surface').boundingBox())!;
  expect(bottomBox.y + bottomBox.height).toBeCloseTo(
    groupBox.y + groupBox.height,
    0,
  );
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

for (const typed of [false, true]) {
  test(`a newly created bar can drag directly from its ${typed ? 'typed' : 'empty'} name input`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Empty');
    const lane = await laneGeometry(page);
    await page.mouse.move(lane.x(0), lane.y);
    await page.mouse.down();
    await page.mouse.move(lane.x(3), lane.y);
    await page.mouse.up();
    const input = page.getByRole('textbox', { name: 'Bar name', exact: true });
    await expect(input).toBeFocused();
    await input.hover();
    await expect(input).toHaveCSS('cursor', 'grab');
    if (typed) await input.fill('New work');
    const bar = page.locator('.bar');
    await settled(bar);
    const box = (await input.boundingBox())!;
    const x = Math.round(box.x + box.width / 2),
      y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + lane.width * 4, y, { steps: 5 });
    await page.mouse.up();
    await interval(bar, 4, 7);
    await expect(input).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await interval(bar, 0, 3);
    if (typed) {
      await expect(bar.locator('span')).toHaveText('New work');
      await page.keyboard.press('Control+z');
    }
    await expect(bar.locator('span')).toHaveText('');
    await page.keyboard.press('Control+z');
    await expect(bar).toHaveCount(0);
  });
}

test('the bar name is editable in the menu heading with commit, cancel and text undo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  await bar.click({ button: 'right' });
  const menu = page.getByRole('menu');
  const input = menu.getByRole('textbox', { name: 'Bar name', exact: true });
  await expect(input).toHaveValue('Explore');
  await expect(
    menu.getByRole('menuitem', { name: 'Rename', exact: true }),
  ).toHaveCount(0);
  await input.fill('Changed');
  await page
    .getByRole('menuitemradio', { name: 'Sea blue', exact: true })
    .hover();
  await expect(input).toBeFocused();
  await input.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(bar.locator('span')).toHaveText('Explore');
  await bar.click({ button: 'right' });
  await input.fill('Changed');
  await input.press('Enter');
  await expect(bar.locator('span')).toHaveText('Changed');
  await page.keyboard.press('Control+z');
  await expect(bar.locator('span')).toHaveText('Explore');
});

test('menu naming commits before an outside bar press starts movement, and native text undo stays in the field', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  await bar.click({ button: 'right' });
  const input = page
    .getByRole('menu')
    .getByRole('textbox', { name: 'Bar name', exact: true });
  await input.focus();
  await input.press('End');
  await page.keyboard.type(' draft');
  await input.press('Control+z');
  await expect(input).toHaveValue('Explore');
  await input.fill('Changed');
  await bar.click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(bar.locator('span')).toHaveText('Changed');
  await page.keyboard.press('Control+z');
  await expect(bar.locator('span')).toHaveText('Explore');
});

test('an input click keeps naming open, and cancelling its drag retains the committed name', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Chain');
  const bar = page.getByTestId('bar-a');
  await settled(bar);
  await bar.dblclick();
  const input = page.getByRole('textbox', { name: 'Bar name', exact: true });
  await input.click();
  await expect(input).toBeFocused();
  await input.fill('Named first');
  const box = (await input.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 7);
  await page.mouse.down();
  await page.mouse.move(box.x - 20, box.y + 7);
  await expect(input).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await interval(bar, 0, 2);
  await expect(bar.locator('span')).toHaveText('Named first');
  await page.keyboard.press('Control+z');
  await expect(bar.locator('span')).toHaveText('Research');
});

test('new tiny bars can drag before their naming zoom finishes', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await chooseZoom(page, '0.125');
  await pauseClock(page);
  const lane = await laneGeometry(page);
  const start =
    Math.ceil(
      Number(await page.getByTestId('lane').getAttribute('data-first-week')),
    ) + 2;
  await page.mouse.move(lane.x(start), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(start + 1), lane.y);
  await page.mouse.up();
  const input = page.getByRole('textbox', { name: 'Bar name', exact: true });
  await expect(input).toBeFocused();
  await expect(page.locator('.viewport')).toHaveAttribute('aria-busy', 'true');
  const box = (await input.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + lane.width * 4, y, { steps: 5 });
  await page.mouse.up();
  await interval(page.locator('.bar'), start + 4, start + 5);
  await expect(input).toHaveCount(0);
  await expect(page.locator('.viewport')).toHaveAttribute('aria-busy', 'false');
});
