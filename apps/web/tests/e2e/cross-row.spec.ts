import { test, expect } from '@playwright/test';
import { beginBarDrag, draw, laneGeometry, interval } from '../helpers';

test('production editor: add and name a row, move a bar, create a milestone, and recover complete actions', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await draw(page, 0, 2, 'Discovery');
  await page.getByRole('button', { name: '+ Add row', exact: true }).click();
  await page.getByRole('textbox', { name: 'Row name' }).fill('Design');
  await page.getByRole('textbox', { name: 'Row name' }).press('Enter');
  const row = await laneGeometry(page, 1),
    bar = page.locator('.bar');
  const id = (await bar.getAttribute('data-testid'))!.slice(4);
  const pickup = await beginBarDrag(page, id);
  await page.mouse.move(pickup.x, row.y);
  await page.mouse.up();
  await interval(bar, 0, 2);
  const rowId = await page
    .getByTestId('lane')
    .nth(1)
    .getAttribute('data-row-lane');
  await expect(bar).toHaveAttribute('data-row', rowId!);
  await page.mouse.dblclick(row.x(2.4), row.y);
  await page.getByRole('textbox', { name: 'Milestone name' }).fill('Approved');
  await page.getByRole('textbox', { name: 'Milestone name' }).press('Enter');
  const item = page.locator('.milestone');
  await expect(item).toHaveAttribute('data-boundary', '3');
  await expect(item).toHaveAttribute('data-row', rowId!);
  await page.keyboard.press('Control+z');
  await expect(item.locator('span')).toHaveText('');
  await page.keyboard.press('Control+z');
  await expect(item).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(bar).toHaveAttribute('data-row', 'row-1');
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+y');
  await expect(bar).toHaveAttribute('data-row', rowId!);
  await expect(item.locator('span')).toHaveText('Approved');
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.getByTestId('lane')).toHaveCount(1);
  await expect(page.locator('.bar, .milestone')).toHaveCount(0);
});
