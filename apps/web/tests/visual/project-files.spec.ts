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
  // Recovery is first written by an edit; restoring the title keeps the pictured state.
  await page.getByLabel('Project title').fill('Edited');
  await page.getByLabel('Project title').press('Enter');
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await page.getByLabel('Project title').fill('Untitled');
  await page.getByLabel('Project title').press('Enter');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  await expect(page).toHaveScreenshot('project-recovery-warning.png');
});

test('Home current project and narrow welcome layout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('Autumn release');
  await page.getByLabel('Project title').press('Enter');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Current project' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resume draft' })).toHaveCount(
    0,
  );
  await expect(page).toHaveScreenshot('project-home-current.png');
  await page.setViewportSize({ width: 600, height: 800 });
  await expect(page).toHaveScreenshot('project-home-narrow.png', {
    fullPage: true,
  });
});

test('File toolbar and dropdown fit a smaller desktop window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await expect(page).toHaveScreenshot('project-file-menu-narrow.png');
});
