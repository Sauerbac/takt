import { test, expect } from '@playwright/test';
import { draw, interval, laneGeometry, zoomToWeekZero } from '../helpers';

test('a fresh production document has the agreed defaults, mixed deletion restores its hint, and refresh retains a draft before starting a fresh editor', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.locator('.section-name')).toHaveText('Unnamed section');
  await expect(page.locator('.row-name')).toHaveText('Unnamed row');
  await expect(page.getByTestId('lane')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Weeks', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.hint')).toHaveText(
    'Drag to create a bar · Double-click for a milestone.',
  );
  await expect(page.getByRole('textbox')).toHaveCount(1);
  await draw(page, 3, 5);
  await interval(page.locator('.bar'), 3, 5);
  await draw(page, -2, -1);
  await zoomToWeekZero(page);
  await interval(page.locator('.bar').first(), 3, 5);
  await expect(page.locator('[data-week="0"]')).toHaveText('Week 1');
  const lane = await laneGeometry(page);
  await page.mouse.dblclick(lane.x(2.2), lane.y);
  await page.getByRole('textbox', { name: 'Milestone name' }).press('Escape');
  await expect(page.locator('.milestone')).toHaveAttribute(
    'data-boundary',
    '3',
  );
  await page.keyboard.press('Backspace');
  await expect(page.locator('.hint')).toHaveCount(0);
  for (let index = 0; index < 2; index++) {
    await page.locator('.bar').first().click();
    await page.keyboard.press('Delete');
  }
  await expect(page.locator('.hint')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.hint')).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Resume draft' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.locator('.bar, .milestone')).toHaveCount(0);
  await expect(page.locator('.hint')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeDisabled();
});
