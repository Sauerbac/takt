import { test, expect } from '@playwright/test';
import { draw, interval, laneGeometry } from '../helpers';

test('production editor combines user calendar dates, navigation, inheritance and item menu history', async ({
  page,
}) => {
  await page.goto('/');
  await draw(page, 0, 2, 'Explore');
  const bar = page.locator('.bar');
  await page.locator('[data-week="3"]').click();
  await page.locator('input[type=date]').fill('2026-10-05');
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await page.getByRole('button', { name: 'Dates', exact: true }).click();
  await expect(page.locator('[data-week="0"]')).toHaveAccessibleName(
    '14 Sept 2026 · Set date for Week 0',
  );
  await page.locator('.section-name').click({ button: 'right' });
  await page
    .getByRole('menuitemradio', { name: 'Lavender', exact: true })
    .click();
  await expect(bar).toHaveCSS('background-color', 'rgb(181, 162, 224)');
  const lane = await laneGeometry(page);
  await page.mouse.dblclick(lane.x(4.2), lane.y);
  await page
    .getByRole('textbox', { name: 'Milestone name', exact: true })
    .fill('Approved');
  await page
    .getByRole('textbox', { name: 'Milestone name', exact: true })
    .press('Enter');
  await expect(page.locator('.milestone')).toHaveAttribute(
    'title',
    'Approved · 18 Oct 2026',
  );
  await bar.click({ button: 'right' });
  await page.getByRole('menuitemradio', { name: 'Rose', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Zoom', exact: true })
    .selectOption('0.75');
  await page
    .getByRole('region', { name: 'Whole-week Gantt chart', exact: true })
    .focus();
  const zoomed = await laneGeometry(page);
  await page.keyboard.down('Space');
  await page.mouse.move(zoomed.x(5), zoomed.y);
  await page.mouse.down();
  await page.mouse.move(zoomed.x(5) + 50, zoomed.y);
  await page.mouse.up();
  await page.keyboard.up('Space');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(bar).toHaveCSS('background-color', 'rgb(179, 121, 118)');
  await interval(bar, 0, 2);
  await expect(
    page.getByRole('combobox', { name: 'Zoom', exact: true }),
  ).toHaveValue('0.75');
  await bar.click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Use section color', exact: true })
    .click();
  await expect(bar).toHaveCSS('background-color', 'rgb(181, 162, 224)');
  await page.getByRole('button', { name: 'Weeks', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Dates', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await bar.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete bar', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(bar).toBeVisible();
});
