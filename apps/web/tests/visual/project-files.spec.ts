import { test, expect } from '@playwright/test';
test('Apricot Home, file header, menu and replacement guard', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('project-home.png');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page).toHaveScreenshot('project-header.png');
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await expect(page).toHaveScreenshot('project-file-menu.png');
  await page.getByRole('menuitem', { name: /New project/ }).click();
  await page.getByLabel('Project title').fill('Release plan');
  await page.getByLabel('Project title').press('Enter');
  await page.keyboard.press('Control+n');
  await expect(page).toHaveScreenshot('project-replacement-guard.png');
});
test('Apricot persistent recovery warning', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota full', 'QuotaExceededError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page).toHaveScreenshot('project-recovery-warning.png');
});
