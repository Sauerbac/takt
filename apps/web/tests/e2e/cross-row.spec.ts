import { test, expect } from '@playwright/test';
import {
  beginBarDrag,
  draw,
  laneGeometry,
  interval,
  pauseClock,
  settled,
} from '../helpers';

test('production editor: entering above from the right pushes left after contact and undo restores both rows', async ({
  page,
}) => {
  await page.goto('/');
  await draw(page, 2, 3);
  const neighbor = page.locator('.bar').first();
  await draw(page, 1, 2);
  const chain = page.locator('.bar').nth(1);
  await page
    .getByRole('button', { name: 'Add row to Unnamed section', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Row name' }).press('Escape');
  const source = await laneGeometry(page, 1),
    destination = await laneGeometry(page);
  await page.mouse.move(source.x(0), source.y);
  await page.mouse.down();
  await page.mouse.move(source.x(1), source.y);
  await page.mouse.up();
  await page.getByRole('textbox', { name: 'Bar name' }).press('Escape');
  const carried = page.locator('.bar').last();
  const id = (await carried.getAttribute('data-testid'))!.slice(4);
  const sourceRow = (await carried.getAttribute('data-row'))!;
  await settled(carried);
  await pauseClock(page);
  await beginBarDrag(page, id);
  await page.mouse.move(destination.x(4.5), source.y);
  await page.mouse.move(destination.x(4.5), destination.y);
  await page.clock.runFor(500);
  await page.mouse.move(destination.x(2.5), destination.y);
  await page.clock.runFor(299);
  await interval(neighbor, 2, 3);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await page.clock.runFor(1);
  await interval(neighbor, 1, 2);
  await interval(chain, 0, 1);
  await page.mouse.up();
  await expect(carried).toHaveAttribute('data-row', 'row-1');
  await interval(carried, 2, 3);
  await page.keyboard.press('Control+z');
  await expect(carried).toHaveAttribute('data-row', sourceRow);
  await interval(carried, 0, 1);
  await interval(neighbor, 2, 3);
  await interval(chain, 1, 2);
  await page.keyboard.press('Control+y');
  await expect(carried).toHaveAttribute('data-row', 'row-1');
  await interval(neighbor, 1, 2);
  await interval(chain, 0, 1);
});

test('production editor: inserting the lower bar between two upper bars opens space in both directions', async ({
  page,
}) => {
  await page.goto('/');
  await draw(page, 0, 4);
  const left = page.locator('.bar').first();
  await draw(page, 4, 6);
  const right = page.locator('.bar').nth(1);
  await page
    .getByRole('button', { name: 'Add row to Unnamed section', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Row name' }).press('Escape');
  const source = await laneGeometry(page, 1),
    destination = await laneGeometry(page);
  await page.mouse.move(source.x(2), source.y);
  await page.mouse.down();
  await page.mouse.move(source.x(5), source.y);
  await page.mouse.up();
  await page.getByRole('textbox', { name: 'Bar name' }).press('Escape');
  const carried = page.locator('.bar').last();
  const id = (await carried.getAttribute('data-testid'))!.slice(4),
    sourceRow = (await carried.getAttribute('data-row'))!;
  await settled(carried);
  await pauseClock(page);
  const pickup = await beginBarDrag(page, id);
  await page.mouse.move(pickup.x, destination.y);
  await page.clock.runFor(299);
  await interval(left, 0, 4);
  await interval(right, 4, 6);
  await expect(page.getByTestId('snap-preview')).toHaveAttribute(
    'data-valid',
    'false',
  );
  await page.clock.runFor(1);
  await interval(left, -2, 2);
  await interval(right, 5, 7);
  await page.mouse.up();
  await expect(carried).toHaveAttribute('data-row', 'row-1');
  await interval(carried, 2, 5);
  await page.keyboard.press('Control+z');
  await expect(carried).toHaveAttribute('data-row', sourceRow);
  await interval(left, 0, 4);
  await interval(right, 4, 6);
  await page.keyboard.press('Control+y');
  await interval(left, -2, 2);
  await interval(right, 5, 7);
});

test('production editor: add and name a row, move a bar, create a milestone, and recover complete actions', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await draw(page, 0, 2, 'Discovery');
  await page
    .getByRole('button', { name: 'Add row to Unnamed section', exact: true })
    .click();
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
