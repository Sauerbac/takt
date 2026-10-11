import { test, expect } from '@playwright/test';

for (const width of [800, 1280]) {
  test(`File belongs to the toolbar and only the logo navigates Home at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page
      .getByRole('button', { name: 'New project', exact: true })
      .click();
    const home = page.getByRole('button', { name: 'Home', exact: true });
    const file = page.getByRole('button', { name: 'File', exact: true });
    const logo = (await home.boundingBox())!;
    const fileBounds = (await file.boundingBox())!;
    const title = (await page.getByLabel('Project title').boundingBox())!;
    const undo = (await page
      .getByRole('button', { name: 'Undo', exact: true })
      .boundingBox())!;
    expect(logo.width).toBeLessThan(110);
    expect(logo.x + logo.width).toBeLessThan(title.x);
    expect(title.x + title.width).toBeLessThan(fileBounds.x);
    expect(fileBounds.x + fileBounds.width).toBeLessThan(undo.x);
    expect(await file.evaluate((node) => !!node.closest('.toolbar'))).toBe(
      true,
    );
    await page.mouse.click(logo.x + logo.width + 12, logo.y + logo.height / 2);
    await expect(page.getByLabel('Project title')).toBeVisible();
    await file.click();
    const menu = (await page.getByRole('menu').boundingBox())!;
    expect(menu.x).toBeGreaterThanOrEqual(8);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width - 8);
    await page.keyboard.press('Escape');
    await home.click();
    await expect(
      page.getByRole('heading', { name: 'Welcome to Takt' }),
    ).toBeVisible();
  });
}

test('File menu shares pointer and keyboard focus and dismisses on Tab', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const file = page.getByRole('button', { name: 'File', exact: true });
  await file.click();
  await page
    .getByRole('menuitem', { name: 'Open .takt file', exact: true })
    .hover();
  await expect(
    page.getByRole('menuitem', { name: 'Open .takt file', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(
    page.getByRole('menuitem', { name: 'New project', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('End');
  await expect(
    page.getByRole('menuitem', { name: 'Home', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Home');
  await expect(
    page.getByRole('menuitem', { name: 'New project', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByLabel('Project title')).toBeFocused();
});

test('Home stacks its columns without horizontal overflow in a narrow window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Start', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Room for what’s next' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    600,
  );
  await page.getByRole('button', { name: 'New project', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
});

test('File chevron animates open and closed over 150ms', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const file = page.getByRole('button', { name: 'File', exact: true });
  const chevron = file.locator('svg');
  await page.evaluate(() =>
    document.addEventListener('transitionrun', (event) => {
      if (!(event.target instanceof SVGElement)) return;
      for (const animation of event.target.getAnimations()) {
        animation.pause();
        animation.currentTime = 75;
      }
    }),
  );
  await file.click();
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

test('the web app does not advertise the browser-reserved new-window shortcut', async ({
  page,
}) => {
  await page.goto('/');
  const create = page.getByRole('button', { name: 'New project', exact: true });
  await expect(create.locator('kbd')).toHaveCount(0);
  await expect(
    page
      .getByRole('button', { name: 'Open .takt file', exact: true })
      .locator('kbd'),
  ).toHaveText(/O$/);
  await create.click();
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await expect(
    page.getByRole('menuitem', { name: 'New project', exact: true }),
  ).not.toContainText(/\bN$/);
  await expect(
    page.getByRole('menuitem', { name: 'Open .takt file', exact: true }),
  ).toContainText(/O$/);
});
