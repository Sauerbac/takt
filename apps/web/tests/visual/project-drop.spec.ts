import { test, expect } from '@playwright/test';
import { fileDrag, nativeDrop } from '../project-drop-helpers';

test('Home highlights its drop zone and the editor shows the file-drop prompt', async ({
  page,
}) => {
  await page.goto('/');
  await fileDrag(page, 'dragenter', [{ name: 'plan.takt', bytes: '' }]);
  await expect(page.locator('.drop-zone')).toHaveClass(/drag-active/);
  await expect(page).toHaveScreenshot('project-home-drop-active.png');
  await fileDrag(page, 'dragleave', [{ name: 'plan.takt', bytes: '' }]);
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await fileDrag(page, 'dragenter', [{ name: 'plan.takt', bytes: '' }]);
  await expect(page.locator('.drop-overlay')).toBeVisible();
  await expect(page).toHaveScreenshot('project-editor-drop-active.png');
});

test('native drops use the same Home and editor affordances', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/desktop.html');
  await nativeDrop(page, {
    type: 'enter',
    paths: ['/projects/project-1.takt'],
  });
  await expect(page).toHaveScreenshot('desktop-home-drop-active.png', {
    fullPage: true,
  });
  await nativeDrop(page, { type: 'leave' });
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await nativeDrop(page, {
    type: 'enter',
    paths: ['/projects/project-1.takt'],
  });
  await expect(page).toHaveScreenshot('desktop-editor-drop-active.png');
});
