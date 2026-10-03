import { test, expect } from '@playwright/test';
import { draw, laneGeometry } from '../helpers';

test('production editor organizes sections and rows, confirms container deletion, and restores everything atomically', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Unnamed section', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Section name' }).fill('Research');
  await page.getByRole('textbox', { name: 'Section name' }).press('Enter');
  await page
    .getByRole('button', { name: 'Unnamed row', exact: true })
    .dblclick();
  await page.getByRole('textbox', { name: 'Row name' }).fill('Explore');
  await page.getByRole('textbox', { name: 'Row name' }).press('Enter');
  await draw(page, 0, 2, 'Work');
  const lane = await laneGeometry(page);
  await page.mouse.dblclick(lane.x(5.3), lane.y);
  await page.getByRole('textbox', { name: 'Milestone name' }).fill('Approved');
  await page.getByRole('textbox', { name: 'Milestone name' }).press('Enter');
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByRole('textbox', { name: 'Section name' }).fill('Delivery');
  await page.getByRole('textbox', { name: 'Section name' }).press('Enter');
  await page
    .getByRole('button', { name: 'Add row to Delivery', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Row name' }).fill('Build');
  await page.getByRole('textbox', { name: 'Row name' }).press('Enter');
  const destination = (await page
    .getByRole('button', { name: 'Build', exact: true })
    .boundingBox())!;
  const source = (await page
    .getByRole('button', { name: 'Explore', exact: true })
    .boundingBox())!;
  await page.mouse.move(source.x + 10, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    source.x + 10,
    destination.y + destination.height / 2 + 5,
  );
  await page.mouse.up();
  await page
    .getByRole('button', { name: 'Collapse Delivery', exact: true })
    .click();
  await expect(page.locator('.bar')).toBeHidden();
  await page
    .getByRole('button', { name: 'Delivery', exact: true })
    .click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'Delete section…', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    '2 rows, 1 bar and 1 milestone',
  );
  await page
    .getByRole('button', { name: 'Delete section', exact: true })
    .click();
  await expect(page.locator('.bar')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(
    page.getByRole('button', { name: 'Collapse Delivery', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.bar')).toBeVisible();
  await expect(page.locator('.bar')).toHaveAttribute('data-start', '0');
  await expect(page.locator('.bar')).toHaveAttribute('data-end', '2');
  await expect(page.locator('.milestone')).toHaveAttribute(
    'data-boundary',
    '6',
  );
  await page.keyboard.press('Control+y');
  await expect(page.locator('.bar')).toHaveCount(0);
});
