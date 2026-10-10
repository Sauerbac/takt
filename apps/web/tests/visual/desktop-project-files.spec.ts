import { test, expect } from '@playwright/test';
test('desktop recovery and native File menu', async ({ page }) => {
  await page.goto('/tests/fixtures/desktop.html?recovery');
  await expect(
    page.getByRole('heading', { name: 'Recover unsaved work' }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('desktop-home-recovery.png', {
    fullPage: true,
  });
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await expect(page).toHaveScreenshot('desktop-file-menu.png');
});
test('desktop Home recent files and expanded history', async ({ page }) => {
  await page.goto('/tests/fixtures/desktop.html');
  await expect(page.locator('.recent-entry')).toHaveCount(10);
  await expect(page).toHaveScreenshot('desktop-home-recents.png', {
    fullPage: true,
  });
  await page.getByRole('button', { name: /Show all/ }).click();
  await expect(page.locator('.recent-entry')).toHaveCount(12);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot('desktop-home-all-recents.png', {
    fullPage: true,
  });
});
test('desktop missing file and modified replacement dialogs', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/desktop.html');
  await page.evaluate(() =>
    (
      window as unknown as {
        __desktopFixture: { deleteFile(path: string): void };
      }
    ).__desktopFixture.deleteFile('/projects/project-1.takt'),
  );
  await page
    .getByRole('button', { name: /project-1.takt.*\/projects/ })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveScreenshot('desktop-missing-file.png');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('Native edited project');
  await page.getByLabel('Project title').press('Enter');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveScreenshot('desktop-save-discard-cancel.png');
});
test('desktop external conflict and second reload confirmation', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/desktop.html');
  await page
    .getByRole('button', { name: 'Open .takt file', exact: true })
    .click();
  await page.getByLabel('Project title').fill('Local native work');
  await page.getByLabel('Project title').press('Enter');
  await page.evaluate(() =>
    (
      window as unknown as {
        __desktopFixture: { external(path: string): void };
      }
    ).__desktopFixture.external('/projects/project-1.takt'),
  );
  await page.keyboard.press('Control+s');
  await expect(
    page.getByRole('heading', { name: 'File changed elsewhere' }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('desktop-conflict.png');
  await page
    .getByRole('button', { name: 'Reload their version', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Replace local changes?' }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('desktop-reload-warning.png');
});
