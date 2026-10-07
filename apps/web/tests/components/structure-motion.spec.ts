import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { draw, settled } from '../helpers';

async function freeze(page: Page) {
  await page.evaluate(() => {
    document.addEventListener('transitionrun', (event) => {
      for (const animation of (event.target as HTMLElement).getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
  });
}
async function halfway(target: Locator, property: string) {
  return target.evaluate(async (element, property) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const animation = element
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSTransition &&
          animation.transitionProperty === property,
      );
    if (!animation) throw new Error(`Expected ${property} transition`);
    animation.pause();
    animation.currentTime = 75;
    return {
      duration: animation.effect!.getTiming().duration,
      top: element.getBoundingClientRect().top,
      height: element.getBoundingClientRect().height,
    };
  }, property);
}
async function finish(target: Locator) {
  await target.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  );
}
async function angle(target: Locator) {
  return target.evaluate((element) => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  });
}
async function press(page: Page, name: string) {
  const bounds = (await page
    .getByRole('button', { name, exact: true })
    .boundingBox())!;
  const point = {
    x: Math.round(bounds.x + 20),
    y: Math.round(bounds.y + bounds.height / 2),
  };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  return point;
}

test('undoing creation in a collapsed section animates expansion even after its reveal item disappears', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  await draw(page, -1, 1);
  await page
    .getByRole('button', { name: 'Collapse Unnamed section', exact: true })
    .click();
  const row = page.getByTestId('row-row-1');
  await settled(row);
  await freeze(page);
  await page.keyboard.press('Control+z');
  const expansion = await halfway(row, 'height');
  expect(expansion.duration).toBe(150);
  expect(expansion.height).toBeGreaterThan(0);
  expect(expansion.height).toBeLessThan(44);
  await expect(page.getByTestId('bar-a')).toBeVisible();
  await expect(page.locator('.bar')).toHaveCount(1);
});

test('row contents track immediately, neighbors glide and reverse, and the carried row settles', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  const row = page.getByTestId('row-row-1'),
    neighbor = page.getByTestId('row-row-2');
  const bar = page.getByTestId('bar-a'),
    milestone = page.getByTestId('milestone-m');
  const original = (await row.boundingBox())!,
    originalNeighbor = (await neighbor.boundingBox())!;
  const originalBar = (await bar.boundingBox())!,
    originalMilestone = (await milestone.boundingBox())!;
  await freeze(page);
  const grip = (await page
    .getByRole('button', { name: 'Drag row Discovery', exact: true })
    .boundingBox())!;
  const point = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x, point.y + 50);
  expect((await row.boundingBox())!.y).toBeCloseTo(original.y + 50, 0);
  expect((await bar.boundingBox())!.y).toBeCloseTo(originalBar.y + 50, 0);
  expect((await milestone.boundingBox())!.y).toBeCloseTo(
    originalMilestone.y + 50,
    0,
  );
  expect(
    await row.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s');
  expect(
    await bar.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe('0s');
  const displacement = await halfway(neighbor, 'top');
  expect(displacement.duration).toBe(150);
  expect(displacement.top).toBeGreaterThan(originalNeighbor.y - 44);
  expect(displacement.top).toBeLessThan(originalNeighbor.y);
  await finish(neighbor);
  await page.mouse.move(point.x, point.y - 5);
  const reversal = await halfway(neighbor, 'top');
  expect(reversal.duration).toBe(150);
  expect(reversal.top).toBeGreaterThan(originalNeighbor.y - 44);
  expect(reversal.top).toBeLessThan(originalNeighbor.y);
  await page.mouse.up();
  const settlement = await halfway(row, 'top');
  expect(settlement.duration).toBe(150);
  expect(settlement.top).toBeGreaterThan(original.y - 5);
  expect(settlement.top).toBeLessThan(original.y);
});

test('a whole section and its items track immediately while neighboring structures animate', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  const section = page.getByTestId('section-section-1'),
    neighbor = page.getByTestId('section-section-2');
  const bar = page.getByTestId('bar-a');
  const original = (await section.boundingBox())!,
    originalBar = (await bar.boundingBox())!;
  const neighborOriginal = (await neighbor.boundingBox())!;
  await freeze(page);
  const point = await press(page, 'Research');
  await page.mouse.move(point.x, point.y + 230);
  expect((await section.boundingBox())!.y).toBeCloseTo(original.y + 230, 0);
  expect((await bar.boundingBox())!.y).toBeCloseTo(originalBar.y + 230, 0);
  const flow = await halfway(neighbor, 'top');
  expect(flow.duration).toBe(150);
  expect(flow.top).toBeGreaterThan(neighborOriginal.y - 160);
  expect(flow.top).toBeLessThan(neighborOriginal.y);
  await finish(neighbor);
  await page.mouse.move(point.x, point.y + 8);
  const reverse = await halfway(neighbor, 'top');
  expect(reverse.top).toBeGreaterThan(neighborOriginal.y - 160);
  expect(reverse.top).toBeLessThan(neighborOriginal.y);
  await page.mouse.up();
  const settlement = await halfway(section, 'top');
  expect(settlement.duration).toBe(150);
  expect(settlement.top).toBeGreaterThan(original.y);
  expect(settlement.top).toBeLessThan(original.y + 8);
  expect((await halfway(bar, 'top')).duration).toBe(150);
});

test('the complete section edge starts neighboring motion before its heading reaches that midpoint', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  const section = page.getByTestId('section-section-1');
  const neighbor = page.getByTestId('section-section-2');
  const original = (await neighbor.boundingBox())!;
  await freeze(page);
  const point = await press(page, 'Research');
  await page.mouse.move(point.x, point.y + 79);
  expect((await neighbor.boundingBox())!.y).toBeCloseTo(original.y, 0);
  await page.mouse.move(point.x, point.y + 81);
  const flow = await halfway(neighbor, 'top');
  expect(flow.duration).toBe(150);
  expect(flow.top).toBeGreaterThan(original.y - 160);
  expect(flow.top).toBeLessThan(original.y);
  expect((await section.boundingBox())!.y).toBeCloseTo(
    original.y - 160 + 81,
    0,
  );
  await finish(neighbor);
  await page.mouse.move(point.x, point.y + 79);
  const reversal = await halfway(neighbor, 'top');
  expect(reversal.top).toBeGreaterThan(original.y - 160);
  expect(reversal.top).toBeLessThan(original.y);
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

test('collapse and expansion animate row height and the surrounding layout', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  const row = page.getByTestId('row-row-1'),
    next = page.getByTestId('section-section-2');
  const chevron = page
    .getByTestId('section-section-1')
    .locator('.collapse svg');
  expect(await angle(chevron)).toBeCloseTo(90, 0);
  const original = (await next.boundingBox())!;
  await freeze(page);
  await page
    .getByRole('button', { name: 'Collapse Research', exact: true })
    .click();
  const collapse = await halfway(row, 'height'),
    flow = await halfway(next, 'top');
  expect(collapse.duration).toBe(150);
  expect(collapse.height).toBeGreaterThan(0);
  expect(collapse.height).toBeLessThan(44);
  expect(flow.top).toBeGreaterThan(original.y - 88);
  expect(flow.top).toBeLessThan(original.y);
  expect((await halfway(chevron, 'transform')).duration).toBe(150);
  expect(await angle(chevron)).toBeGreaterThan(0);
  expect(await angle(chevron)).toBeLessThan(90);
  await finish(chevron);
  expect(await angle(chevron)).toBeCloseTo(0, 0);
  await finish(row);
  await finish(next);
  await page
    .getByRole('button', { name: 'Expand Research', exact: true })
    .click();
  const expand = await halfway(row, 'height');
  expect(expand.height).toBeGreaterThan(0);
  expect(expand.height).toBeLessThan(44);
  const restore = await halfway(next, 'top');
  expect(restore.top).toBeGreaterThan(original.y - 88);
  expect(restore.top).toBeLessThan(original.y);
  await halfway(chevron, 'transform');
  expect(await angle(chevron)).toBeGreaterThan(0);
  expect(await angle(chevron)).toBeLessThan(90);
  await finish(chevron);
  expect(await angle(chevron)).toBeCloseTo(90, 0);
});

test('picking up a row during layout motion attaches to its painted position', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Sections');
  const neighbor = page.getByTestId('row-row-2');
  await freeze(page);
  const point = await press(page, 'Discovery');
  await page.mouse.move(point.x, point.y + 50);
  await page.mouse.up();
  await halfway(neighbor, 'top');
  const painted = (await neighbor.boundingBox())!;
  const pickup = await press(page, 'Review');
  await page.mouse.move(pickup.x, pickup.y + 8);
  expect((await neighbor.boundingBox())!.y).toBeCloseTo(painted.y + 8, 0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await neighbor.evaluate((element) =>
    element.getAnimations().forEach((animation) => animation.finish()),
  );
  await settled(neighbor);
});
