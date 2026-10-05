import { zoomToWeekZero } from '../helpers';
import { test, expect } from '@playwright/test';
import { selectDate, chooseZoom } from '../helpers';

test('zoom keyboard navigation works before native popover toggle notifications arrive', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  // Hold the queued notification while still opening the real browser popover
  // with real pointer/keyboard input. Component-initiated state is immediate.
  await page.evaluate(() =>
    document.addEventListener(
      'toggle',
      (event) => {
        if (
          event.target instanceof HTMLElement &&
          event.target.getAttribute('role') === 'listbox'
        )
          event.stopImmediatePropagation();
      },
      true,
    ),
  );
  const zoom = page.getByRole('combobox', { name: 'Zoom', exact: true });
  await zoom.click();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('option', { name: '200%', exact: true }),
  ).toBeFocused();
  await expect(zoom).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(zoom).toHaveAttribute('aria-expanded', 'false');
  await zoom.click();
  await page.keyboard.press('Home');
  await expect(
    page.getByRole('option', { name: '12.5%', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(zoom).toHaveText('12.5%');
  await expect(zoom).toBeFocused();
});

test('custom zoom menu supports keyboard selection, dismissal, focus and wheel values', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  const zoom = page.getByRole('combobox', { name: 'Zoom', exact: true });
  await zoom.focus();
  await zoom.press('ArrowDown');
  await expect(
    page.getByRole('option', { name: '100%', exact: true }),
  ).toBeFocused();
  await expect(zoom).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(zoom).toHaveText('125%');
  await expect(zoom).toBeFocused();
  await expect(zoom).toHaveAttribute('aria-expanded', 'false');
  await zoom.click();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('option', { name: '200%', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(zoom).toHaveText('125%');
  await expect(zoom).toBeFocused();
  await zoom.click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Space');
  await expect(zoom).toHaveText('12.5%');
  await zoom.click();
  await page.mouse.click(10, 10);
  await expect(zoom).toHaveAttribute('aria-expanded', 'false');
  await zoom.click();
  await page.keyboard.press('Tab');
  await expect(zoom).toHaveAttribute('aria-expanded', 'false');
  await expect(
    page.getByRole('button', { name: 'Weeks', exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  const lane = (await page.getByTestId('lane').first().boundingBox())!;
  await page.mouse.move(lane.x + lane.width / 2, lane.y + 20);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -80);
  await page.keyboard.up('Control');
  await expect(zoom).toHaveText('15%');
  await zoom.click();
  await expect(page.getByRole('option', { selected: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('Today sits beside month navigation and chooses an uncommitted draft', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'));
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await zoomToWeekZero(page);
  await page.getByRole('button', { name: 'Dates', exact: true }).click();
  const date = page
    .getByRole('grid')
    .locator('td[aria-selected="true"] button');
  await expect(date).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByText('Selected date', { exact: true })).toHaveCount(0);
  await expect(
    page
      .locator('.month-navigation')
      .getByRole('button', { name: 'Today', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(date).toHaveAttribute('data-date', '2026-10-04');
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByRole('grid')).toHaveAccessibleName('November 2026');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await expect(page.locator('[data-week="0"]')).toHaveAccessibleName(
    '4 Oct 2026 · Set date for Week 0',
  );
});

test('custom calendar opens centered with backdrop, confines focus and commits only the selected draft', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  await zoomToWeekZero(page);
  const heading = page.locator('[data-week="3"]');
  await heading.click();
  const dialog = page.getByRole('dialog');
  const date = page
    .getByRole('grid')
    .locator('td[aria-selected="true"] button');
  await expect(page.getByRole('grid')).toBeVisible();
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x + bounds.width / 2).toBeCloseTo(640, 0);
  expect(bounds.y + bounds.height / 2).toBeCloseTo(400, 0);
  expect(
    await dialog.evaluate(
      (node) => getComputedStyle(node, '::backdrop').backgroundColor,
    ),
  ).toBe('rgba(24, 46, 71, 0.19)');
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await expect(page.getByRole('grid')).toHaveAccessibleName('November 2026');
  await page.getByRole('button', { name: '12 Nov 2026', exact: true }).click();
  await expect(date).toHaveAttribute('data-date', '2026-11-12');
  await page.getByRole('button', { name: 'Set date', exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(heading).toBeFocused();
  await expect(heading).toHaveAccessibleName(
    '5 Oct 2026 · Set date for Week 3',
  );
  await heading.click();
  await page.getByRole('button', { name: '12 Oct 2026', exact: true }).click();
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await expect(heading).toHaveAccessibleName(
    '12 Oct 2026 · Set date for Week 3',
  );
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(heading).toHaveAccessibleName(
    '5 Oct 2026 · Set date for Week 3',
  );
});

test('calendar handles leap-day keyboard navigation, month boundaries and selection', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await zoomToWeekZero(page);
  await page.getByRole('button', { name: 'Dates', exact: true }).click();
  const date = page
    .getByRole('grid')
    .locator('td[aria-selected="true"] button');
  await selectDate(page, '2024-02-28');
  await page.getByRole('button', { name: '28 Feb 2024', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('button', { name: '29 Feb 2024', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(
    page.getByRole('button', { name: '1 Mar 2024', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('PageUp');
  await expect(
    page.getByRole('button', { name: '1 Feb 2024', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Home');
  await expect(
    page.getByRole('button', { name: '29 Jan 2024', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Space');
  await expect(date).toHaveAttribute('data-date', '2024-01-29');
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await expect(page.locator('[data-week="0"]')).toHaveAccessibleName(
    '29 Jan 2024 · Set date for Week 0',
  );
});

test('zoom chevron rotates through an actual transition and settles in both directions', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  const zoom = page.getByRole('combobox', { name: 'Zoom', exact: true });
  const chevron = zoom.locator('svg');
  await page.evaluate(() =>
    document.addEventListener('transitionrun', (event) => {
      if (!(event.target instanceof SVGElement)) return;
      for (const animation of event.target.getAnimations()) {
        animation.pause();
        animation.currentTime = 75;
      }
    }),
  );
  await zoom.click();
  await expect(zoom).toHaveAttribute('aria-expanded', 'true');
  await expect
    .poll(() => chevron.evaluate((node) => node.getAnimations().length))
    .toBeGreaterThan(0);
  const midway = await chevron.evaluate((node) => {
    const animation = node.getAnimations()[0];
    const angle = Math.abs(new DOMMatrix(getComputedStyle(node).transform).a);
    animation.finish();
    return { angle, duration: animation.effect!.getTiming().duration };
  });
  expect(midway.duration).toBe(150);
  expect(midway.angle).toBeLessThan(0.99);
  await expect(chevron).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
  await page.keyboard.press('Escape');
  await expect
    .poll(() => chevron.evaluate((node) => node.getAnimations().length))
    .toBeGreaterThan(0);
  await chevron.evaluate((node) =>
    node.getAnimations().forEach((animation) => animation.finish()),
  );
  await expect(chevron).toHaveCSS('transform', 'none');
});
