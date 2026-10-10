import { test, expect } from '@playwright/test';
import { setHue } from '../helpers';
import { colorAppearance } from '../../src/model/colors';

const rgb = (hue: number) => {
  const hex = colorAppearance(hue).fill;
  return `rgb(${[1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`;
};

test('all color menus retain their target, preview continuous drafts and apply one undoable change', async ({
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
    await expect(page.locator('.color-label')).toHaveText('Color');
    await page
      .getByRole('menuitem', { name: 'More colors…', exact: true })
      .click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    const slider = page.getByRole('slider', { name: 'Hue', exact: true });
    await expect(slider).toBeFocused();
    await expect(slider).toHaveValue('300');
    await setHue(page, 87.4);
    await expect(bar).toHaveCSS('background-color', rgb(300));
    await expect(page.locator('.preview-bar')).toHaveCSS(
      'background-color',
      rgb(87.4),
    );
    await page
      .getByRole('button', { name: 'Apply color', exact: true })
      .click();
    const changed = target === milestone ? milestone.locator('i') : bar;
    await expect(changed).toHaveCSS('background-color', rgb(87.4));
    if (target === bar)
      await expect(milestone.locator('i')).toHaveCSS(
        'background-color',
        rgb(300),
      );
    await expect(override).toHaveCSS('background-color', rgb(50));
    await undo.click();
    await expect(changed).toHaveCSS('background-color', rgb(300));
    await redo.click();
    await expect(changed).toHaveCSS('background-color', rgb(87.4));
    await target.click({ button: 'right' });
    await page
      .getByRole('menuitem', { name: 'More colors…', exact: true })
      .click();
    await expect(slider).toHaveValue('87.4');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await undo.click();
  }
});

test('slider keyboard controls, modal focus and dismissal preserve the document and redo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  await bar.click({ button: 'right' });
  await page.getByRole('menuitemradio', { name: 'Sage', exact: true }).click();
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
    const slider = page.getByRole('slider', { name: 'Hue', exact: true });
    await expect(slider).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('301');
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('300');
    await page.keyboard.press('PageUp');
    await expect(slider).toHaveValue('310');
    await page.keyboard.press('PageDown');
    await expect(slider).toHaveValue('300');
    await page.keyboard.press('Home');
    await expect(slider).toHaveValue('0');
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue('0');
    await page.keyboard.press('End');
    await expect(slider).toHaveValue('359.9');
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('359.9');
    await page
      .getByRole('button', { name: 'Apply color', exact: true })
      .focus();
    await page.keyboard.press('Tab');
    await expect(slider).toBeFocused();
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
    await expect(bar).toHaveCSS('background-color', rgb(300));
  }
});

test('slider-picked hues are reusable across sections, bars and milestones without duplicate swatches', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  await bar.click({ button: 'right' });
  await page
    .getByRole('menuitem', { name: 'More colors…', exact: true })
    .click();
  await setHue(page, 87.4);
  await page.getByRole('button', { name: 'Apply color', exact: true }).click();
  for (const target of [
    page.getByTestId('bar-b'),
    page.getByTestId('milestone-m'),
    page.locator('.section-name').last(),
  ]) {
    await target.click({ button: 'right' });
    const custom = page.getByRole('menuitemradio', {
      name: 'Hue 87.4°',
      exact: true,
    });
    await expect(custom).toHaveCount(1);
    await expect(custom).toHaveCSS('background-color', rgb(87.4));
    await custom.focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('bar-b')).toHaveCSS(
    'background-color',
    rgb(87.4),
  );
  await expect(page.getByTestId('milestone-m').locator('i')).toHaveCSS(
    'background-color',
    rgb(87.4),
  );
  await bar.click({ button: 'right' });
  await expect(
    page.getByRole('menuitemradio', { name: 'Hue 87.4°', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('menuitemradio')).toHaveCount(5);
  await page
    .getByRole('menuitem', { name: 'More colors…', exact: true })
    .click();
  await setHue(page, 99.9);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await bar.click({ button: 'right' });
  await expect(
    page.getByRole('menuitemradio', { name: 'Hue 99.9°', exact: true }),
  ).toHaveCount(0);
});

test('pointer dragging previews the spectrum, the plus is centered and presets use the same appearance', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CalendarColors');
  const bar = page.getByTestId('bar-a');
  await bar.click({ button: 'right' });
  const plus = page.getByRole('menuitem', {
    name: 'More colors…',
    exact: true,
  });
  const button = (await plus.boundingBox())!;
  const icon = (await plus.locator('svg').boundingBox())!;
  expect(icon.x + icon.width / 2).toBeCloseTo(button.x + button.width / 2, 1);
  expect(icon.y + icon.height / 2).toBeCloseTo(button.y + button.height / 2, 1);
  await expect(
    page.getByRole('menuitemradio', { name: 'Sage', exact: true }),
  ).toHaveCSS('background-color', rgb(145));
  await plus.click();
  const slider = page.getByRole('slider', { name: 'Hue', exact: true });
  const bounds = (await slider.boundingBox())!;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(bounds.x + bounds.width * 0.85, y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.4, y, { steps: 8 });
  await page.mouse.up();
  const hue = Number(await slider.inputValue());
  expect(hue).toBeGreaterThan(120);
  expect(hue).toBeLessThan(170);
  await expect(page.locator('.preview-bar')).toHaveCSS(
    'background-color',
    rgb(hue),
  );
  await expect(bar).toHaveCSS('background-color', rgb(300));
  await slider.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(bar).toHaveCSS('background-color', rgb(hue));
});
