import { test, expect } from '@playwright/test';
import { settled } from '../helpers';

test('a click anywhere in the section name opens borderless editing with reversible naming history', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=CrossRows');
  const section = page.locator('.section-name');
  const bounds = (await section.boundingBox())!;
  await page.mouse.click(
    bounds.x + bounds.width - 2,
    bounds.y + bounds.height / 2,
  );
  const input = page.getByRole('textbox', { name: 'Section name' });
  await expect(input).toBeFocused();
  await input.fill('Product');
  await input.press('Enter');
  await expect(section).toHaveText('Product');
  await section.click({ position: { x: 2, y: 5 } });
  await expect(input).toBeFocused();
  expect(
    await input.evaluate((element: HTMLInputElement) => [
      element.selectionStart,
      element.selectionEnd,
    ]),
  ).toEqual([7, 7]);
  await input.press('!');
  await input.press('Escape');
  await expect(section).toHaveText('Product');
  await section.click();
  await input.press('!');
  await page.locator('header').click();
  await expect(section).toHaveText('Product!');
  await page.keyboard.press('Control+z');
  await expect(section).toHaveText('Product');
  await page.keyboard.press('Control+z');
  await expect(section).toHaveText('Unnamed section');
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+y');
  await expect(section).toHaveText('Product!');
  await expect(page.locator('.bar')).toHaveCount(4);
  await expect(page.locator('.milestone')).toHaveCount(2);
});

for (const kind of ['Row', 'Bar', 'Milestone'] as const) {
  test(`${kind} naming starts with the caret at the end and typing appends to the existing label`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=CrossRows');
    const item =
      kind === 'Row'
        ? page.getByRole('button', { name: 'Research', exact: true })
        : page.getByTestId(kind === 'Bar' ? 'bar-a' : 'milestone-m');
    if (kind !== 'Row') await settled(item);
    if (kind === 'Milestone') {
      const label = (await item.locator('span').boundingBox())!;
      await page.mouse.dblclick(
        label.x + label.width / 2,
        label.y + label.height / 2,
      );
    } else await item.dblclick();
    const input = page.getByRole('textbox', { name: `${kind} name` });
    await expect(input).toBeFocused();
    const value = await input.inputValue();
    expect(
      await input.evaluate((element: HTMLInputElement) => [
        element.selectionStart,
        element.selectionEnd,
      ]),
    ).toEqual([value.length, value.length]);
    await page.keyboard.type(' extra');
    await expect(input).toHaveValue(`${value} extra`);
    await input.press('Enter');
    await page.keyboard.press('Control+z');
    if (kind === 'Row')
      await expect(
        page.getByRole('button', { name: value, exact: true }),
      ).toBeVisible();
    else await expect(item.locator('span')).toHaveText(value);
  });
}

test('undoing a section rename reveals its heading after scrolling through rows', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  await page.locator('.section-name').click();
  const input = page.getByRole('textbox', { name: 'Section name' });
  await input.fill('Planning');
  await input.press('Enter');
  await page.locator('.viewport').evaluate((element) => {
    element.scrollTop = 500;
  });
  await page.keyboard.press('Control+z');
  await expect(page.locator('.section-name')).toHaveText('Unnamed section');
  await expect(page.locator('.section-name')).toBeInViewport();
  await page.keyboard.press('Control+y');
  await expect(page.locator('.section-name')).toHaveText('Planning');
});
