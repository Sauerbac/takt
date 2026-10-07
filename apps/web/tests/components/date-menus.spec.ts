import { zoomToWeekZero } from '../helpers';
import { chooseZoom } from '../helpers';
import { test, expect } from '@playwright/test';
import { interval, selectDate } from '../helpers';

for (const entry of ['heading', 'heading menu']) {
  test(`reset from ${entry} switches Weeks to Dates as one undoable action`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=CalendarColors');
    await zoomToWeekZero(page);
    const weeks = page.getByRole('button', { name: 'Weeks', exact: true });
    const dates = page.getByRole('button', { name: 'Dates', exact: true });
    await weeks.click();
    const heading = page.locator('[data-week="3"]');
    if (entry === 'heading') await heading.click();
    else {
      await heading.click({
        button: 'right',
      });
      await page
        .getByRole('menuitem', { name: 'Reset reference', exact: true })
        .click();
    }
    await selectDate(page, '2026-10-12');
    await page.keyboard.press('Escape');
    await expect(weeks).toHaveAttribute('aria-pressed', 'true');
    if (entry === 'heading') await heading.click();
    else {
      await heading.click({
        button: 'right',
      });
      await page
        .getByRole('menuitem', { name: 'Reset reference', exact: true })
        .click();
    }
    await selectDate(page, '2026-10-12');
    await page.getByRole('button', { name: 'Set date', exact: true }).click();
    await expect(dates).toHaveAttribute('aria-pressed', 'true');
    const reference = page.locator('[data-week="3"]');
    await expect(reference).toHaveAccessibleName(
      '12 Oct 2026 · Set date for Week 3',
    );
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(weeks).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(dates).toHaveAttribute('aria-pressed', 'true');
    await expect(reference).toHaveAccessibleName(
      '12 Oct 2026 · Set date for Week 3',
    );
    await interval(page.getByTestId('bar-a'), 0, 2);
  });
}

test('heading reference menus retain their week, cancel cleanly and clear/restore the date mapping atomically', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  await zoomToWeekZero(page);
  const heading = page.locator('[data-week="3"]');
  const dates = page.getByRole('button', { name: 'Dates', exact: true });
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  const referenceDate = page
    .getByRole('grid')
    .locator('td[aria-selected="true"] button');

  await heading.click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeFocused();
  await expect(page.getByRole('menuitem')).toHaveText(['Set reference']);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(referenceDate).toHaveCount(0);
  await selectDate(page, '2026-10-05');
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await expect(dates).toHaveAttribute('aria-pressed', 'true');
  await expect(heading).toHaveAccessibleName(
    '5 Oct 2026 · Set date for Week 3',
  );

  await heading.click({ button: 'right' });
  await expect(page.getByRole('menuitem')).toHaveText([
    'Reset reference',
    'Clear reference',
  ]);
  await page.getByRole('menuitem', { name: 'Reset reference' }).click();
  await expect(referenceDate).toHaveAttribute('data-date', '2026-10-05');
  await selectDate(page, '2026-10-12');
  await page.keyboard.press('Escape');
  await expect(heading).toBeFocused();
  await expect(heading).toHaveAccessibleName(
    '5 Oct 2026 · Set date for Week 3',
  );

  await heading.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Reset reference' }).click();
  await selectDate(page, '2026-10-12');
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await expect(page.locator('[data-week="0"]')).toHaveAccessibleName(
    '21 Sept 2026 · Set date for Week 0',
  );
  await heading.click({ button: 'right' });
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(dates).toHaveAttribute('aria-pressed', 'false');
  await expect(heading).toHaveText('Week 3');
  await interval(page.getByTestId('bar-a'), 0, 2);
  await expect(page.getByTestId('milestone-m')).toHaveAttribute(
    'title',
    'Kickoff · End of Week 4',
  );
  await undo.click();
  await expect(dates).toHaveAttribute('aria-pressed', 'true');
  await expect(heading).toHaveAccessibleName(
    '12 Oct 2026 · Set date for Week 3',
  );
  await redo.click();
  await dates.click();
  await expect(referenceDate).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await undo.click();
  await undo.click();
  await expect(heading).toHaveAccessibleName(
    '5 Oct 2026 · Set date for Week 3',
  );
});

test('Dates toolbar reference menu uses Week 0, restores focus, and preserves redo on dismissal', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  await zoomToWeekZero(page);
  const dates = page.getByRole('button', { name: 'Dates', exact: true });
  await dates.click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeFocused();
  await page.getByRole('menuitem', { name: 'Set reference' }).click();
  const field = page
    .getByRole('grid')
    .locator('td[aria-selected="true"] button');
  await selectDate(page, '2026-10-07');
  await page.getByRole('button', { name: 'Set date', exact: true }).click();
  await expect(dates).toBeFocused();
  await expect(dates).toHaveAttribute('aria-pressed', 'true');
  await dates.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Reset reference' }).click();
  await expect(field).toHaveAttribute('data-date', '2026-10-07');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dates.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Clear reference' }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await dates.click({ button: 'right' });
  await page.mouse.click(10, 10);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeEnabled();
  await dates.click();
  await expect(page.locator('[data-week="0"]')).toHaveAccessibleName(
    '7 Oct 2026 · Set date for Week 0',
  );
});

test('browser context menus remain available outside chart targets, in inline fields and dialogs', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  await zoomToWeekZero(page);
  await expect(page.getByTestId('bar-a')).toBeVisible();
  await page.evaluate(() => {
    window.addEventListener(
      'contextmenu',
      (event) => {
        setTimeout(() => {
          document.body.dataset.contextPrevented = String(
            event.defaultPrevented,
          );
        }, 0);
      },
      { capture: true },
    );
  });
  for (const target of [
    page.locator('.brand'),
    page.getByRole('button', { name: 'Weeks', exact: true }),
    page.getByRole('combobox', { name: 'Zoom', exact: true }),
    page.locator('.lane-heading'),
    page.locator('footer'),
    page.locator('main'),
  ]) {
    await page.locator('body').evaluate((body) => {
      delete body.dataset.contextPrevented;
    });
    const box = (await target.boundingBox())!;
    await page.mouse.click(box.x + 2, box.y + 2, { button: 'right' });
    await expect(page.locator('body')).toHaveAttribute(
      'data-context-prevented',
      'false',
    );
    await expect(page.getByRole('menu')).toHaveCount(0);
  }

  await page.getByTestId('bar-a').click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeFocused();
  const name = page.getByRole('textbox', { name: 'Bar name', exact: true });
  await name.click({ button: 'right' });
  await expect(page.locator('body')).toHaveAttribute(
    'data-context-prevented',
    'false',
  );
  await page.keyboard.press('Escape');

  await page.locator('[data-week="3"]').click();
  await page.getByRole('grid').locator('button[tabindex="0"]').click({
    button: 'right',
  });
  await expect(page.locator('body')).toHaveAttribute(
    'data-context-prevented',
    'false',
  );
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
});
