import { expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

export async function selectDate(page: Page, date: string) {
  const grid = page.getByRole('grid');
  const focused = grid.locator('button[tabindex="0"]');
  const current = (await focused.getAttribute('data-date'))!;
  const months =
    (Number(date.slice(0, 4)) - Number(current.slice(0, 4))) * 12 +
    Number(date.slice(5, 7)) -
    Number(current.slice(5, 7));
  await focused.focus();
  for (let i = 0; i < Math.abs(months); i++) {
    await page.keyboard.press(months < 0 ? 'PageUp' : 'PageDown');
  }
  await grid.locator(`[data-date="${date}"]`).click();
}

export async function chooseColor(page: Page, name: string) {
  const quick = page.getByRole('menuitemradio', { name, exact: true });
  if (await quick.count()) await quick.click();
  else {
    await page
      .getByRole('menuitem', { name: 'More colors…', exact: true })
      .click();
    const hues: Record<string, number> = { Rose: 15, Slate: 260 };
    if (!(name in hues)) throw new Error(`Unknown test color: ${name}`);
    await setHue(page, hues[name]);
    await page
      .getByRole('button', { name: 'Apply color', exact: true })
      .click();
  }
}

export async function setHue(page: Page, hue: number) {
  await page
    .getByRole('slider', { name: 'Hue', exact: true })
    .evaluate((node, value) => {
      const slider = node as HTMLInputElement;
      slider.value = String(value);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, hue);
}

export async function chooseZoom(page: Page, scale: string) {
  await page.getByRole('combobox', { name: 'Zoom', exact: true }).click();
  await page
    .getByRole('option', { name: `${Number(scale) * 100}%`, exact: true })
    .click();
}

// Calendar-reference scenarios deliberately show individual dates around the
// origin. Toolbar zoom preserves the center, so explicitly pan back to Week 1.
export async function zoomToWeekZero(page: Page) {
  await chooseZoom(page, '2');
  const lane = page.getByTestId('lane').first();
  const first = Number(await lane.getAttribute('data-first-week'));
  const width = Number(await lane.getAttribute('data-week-width'));
  const bounds = (await lane.boundingBox())!;
  await page.mouse.move(bounds.x + 100, bounds.y + 22);
  await page.mouse.wheel((-2 - first) * width, 0);
  await expect(page.locator('[data-week="0"]')).toBeInViewport({ ratio: 1 });
}

export async function laneGeometry(page: Page, row = 0) {
  const element = page.getByTestId('lane').nth(row);
  const bounds = await element.boundingBox();
  if (!bounds) throw new Error('Timeline is not visible');
  const firstWeek = Number(await element.getAttribute('data-first-week'));
  const weekWidth = Number(await element.getAttribute('data-week-width'));
  return {
    x: (week: number) => bounds.x + (week - firstWeek) * weekWidth,
    y: bounds.y + 22,
    width: weekWidth,
  };
}
export async function draw(
  page: Page,
  from: number,
  to: number,
  name?: string,
) {
  const lane = await laneGeometry(page);
  await page.mouse.move(lane.x(from), lane.y);
  await page.mouse.down();
  await page.mouse.move(lane.x(to), lane.y, { steps: 5 });
  await page.mouse.up();
  const input = page.getByRole('textbox', { name: 'Bar name' });
  await expect(input).toBeFocused();
  if (name !== undefined) {
    await input.fill(name);
    await input.press('Enter');
  } else await input.press('Escape');
  // Ordinary scenarios continue from the finished view transition. Dedicated
  // overview motion tests drive creation and the animation clock directly.
  await expect(page.locator('.viewport')).toHaveAttribute('aria-busy', 'false');
}
export async function interval(bar: Locator, start: number, end: number) {
  await expect(bar).toHaveAttribute('data-start', String(start));
  await expect(bar).toHaveAttribute('data-end', String(end));
}
export async function readyToDrop(page: Page) {
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'true',
  );
}
export async function pauseClock(page: Page) {
  // Initial width measurement can start settlement transitions. Clock-based
  // behavioral tests begin from a settled fixture; interrupted pickup is
  // exercised separately by dedicated motion tests.
  await page.locator('.chart').evaluate(async (element) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      [element, ...element.querySelectorAll('*')].flatMap((element) =>
        element
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
  });
  const time = new Date('2026-10-03T12:00:00Z');
  // Leave room for real time between installation and pausing, especially in Firefox.
  await page.clock.install({ time: new Date(time.getTime() - 60_000) });
  await page.clock.pauseAt(time);
}
export async function beginBarDrag(
  page: Page,
  id: string,
  edge?: 'left' | 'right',
) {
  const target = page.getByTestId(`bar-${id}`);
  const bounds = await target.boundingBox();
  if (!bounds) throw new Error('Bar is not visible');
  const rawX =
    edge === 'left'
      ? bounds.x + 4
      : edge === 'right'
        ? bounds.x + bounds.width - 4
        : bounds.x + bounds.width / 2;
  const x = Math.round(rawX);
  const y = Math.round(bounds.y + bounds.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y };
}
export async function settled(bar: Locator) {
  await bar.evaluate(async (element) => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
}
export async function expectPosition(
  page: Page,
  id: string,
  start: number,
  end: number,
) {
  const bar = page.getByTestId(`bar-${id}`);
  await interval(bar, start, end);
  await settled(bar);
  const lane = await laneGeometry(page);
  const bounds = await bar.boundingBox();
  expect(bounds!.x).toBeCloseTo(lane.x(start) + 5, 0);
  expect(bounds!.width).toBeCloseTo((end - start) * lane.width - 10, 0);
}
