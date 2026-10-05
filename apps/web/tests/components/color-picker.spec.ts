import { test, expect } from '@playwright/test';

test('all color menus open the shared picker, apply to the retained target and preserve inheritance and history', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  const override = page.getByTestId('bar-b');
  const milestone = page.getByTestId('milestone-m');
  const undo = page.getByRole('button', { name: 'Undo', exact: true });
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  for (const target of [
    page.locator('.section-name').first(),
    bar,
    milestone,
  ]) {
    await target.click({ button: 'right' });
    await expect(page.getByRole('menuitemradio')).toHaveCount(4);
    await expect(page.getByRole('menu')).not.toContainText('Apricot');
    await page
      .getByRole('menuitem', { name: 'More colors…', exact: true })
      .click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(18);
    await expect(
      page.getByRole('radio', { name: 'Lavender', exact: true }),
    ).toBeFocused();
    await page.getByRole('radio', { name: 'Deep sage', exact: true }).click();
    await expect(bar).toHaveCSS('background-color', 'rgb(181, 162, 224)');
    await expect(page.locator('.preview-bar')).toHaveCSS(
      'background-color',
      'rgb(86, 123, 93)',
    );
    await page
      .getByRole('button', { name: 'Apply color', exact: true })
      .click();
    const changed = target === milestone ? milestone.locator('i') : bar;
    await expect(changed).toHaveCSS('background-color', 'rgb(86, 123, 93)');
    if (target === bar)
      await expect(milestone.locator('i')).toHaveCSS(
        'background-color',
        'rgb(181, 162, 224)',
      );
    await expect(override).toHaveCSS('background-color', 'rgb(243, 177, 132)');
    await undo.click();
    await expect(changed).toHaveCSS('background-color', 'rgb(181, 162, 224)');
    await redo.click();
    await expect(changed).toHaveCSS('background-color', 'rgb(86, 123, 93)');
    await undo.click();
  }
});

test('picker keyboard navigation, focus containment and all dismissal routes discard drafts and preserve redo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  await bar.click({ button: 'right' });
  await page.getByRole('menuitemradio', { name: 'Slate', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const chart = page.getByRole('region', {
    name: 'Whole-week Gantt chart',
    exact: true,
  });
  for (const dismiss of ['Cancel', 'Escape', 'Backdrop']) {
    await bar.click({ button: 'right' });
    await page
      .getByRole('menuitem', { name: 'More colors…', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', {
      name: 'Choose color',
      exact: true,
    });
    await expect(
      page.getByRole('radio', { name: 'Lavender', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('radio', { name: 'Deep lavender', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await expect(
      page.getByRole('radio', { name: 'Peach', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Home');
    await expect(
      page.getByRole('radio', { name: 'Light peach', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(
      page.getByRole('radio', { name: 'Deep slate', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('End');
    await page
      .getByRole('button', { name: 'Apply color', exact: true })
      .focus();
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('radio', { name: 'Deep slate', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(
      page.getByRole('button', { name: 'Apply color', exact: true }),
    ).toBeFocused();
    if (dismiss === 'Cancel')
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    else if (dismiss === 'Escape') await page.keyboard.press('Escape');
    else await page.mouse.click(10, 10);
    await expect(dialog).toHaveCount(0);
    await expect(chart).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Redo', exact: true }),
    ).toBeEnabled();
    await expect(bar).toHaveCSS('background-color', 'rgb(181, 162, 224)');
  }
});
