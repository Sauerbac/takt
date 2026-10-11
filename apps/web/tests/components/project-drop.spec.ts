import { test, expect } from '@playwright/test';
import { encodeProject, newProject } from '../../src/project/format';
import { fileDrag, nativeDrop } from '../project-drop-helpers';

const incoming = {
  name: 'Launch.TAKT',
  bytes: encodeProject({ ...newProject(), title: 'Dropped launch' }),
};

test('wrong file types and batches are rejected without changing the active project', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await fileDrag(page, 'drop', [{ ...incoming, name: 'notes.txt' }]);
  await expect(page.getByRole('alert')).toContainText(
    'Drop a .takt project file.',
  );
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await fileDrag(page, 'drop', [
    incoming,
    { ...incoming, name: 'second.takt' },
  ]);
  await expect(page.getByRole('alert')).toContainText(
    'Drop one .takt file at a time.',
  );
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await page.goto('/tests/fixtures/desktop.html');
  await nativeDrop(page, {
    type: 'drop',
    paths: ['first.takt', 'second.takt'],
  });
  await expect(page.getByRole('alert')).toContainText(
    'Drop one .takt file at a time.',
  );
  await expect(
    page.getByRole('heading', { name: 'Welcome to Takt' }),
  ).toBeVisible();
});

test('Home drop zone opens files, survives nested drag boundaries, and remains a browse control', async ({
  page,
}) => {
  await page.goto('/');
  const zone = page.getByRole('button', {
    name: 'Open .takt file',
  });
  expect((await fileDrag(page, 'dragenter', [incoming])).prevented).toBe(true);
  await fileDrag(page, 'dragenter', [incoming], '.drop-zone strong');
  await expect(zone).toHaveClass(/drag-active/);
  await fileDrag(page, 'dragleave', [incoming], '.drop-zone strong');
  await expect(zone).toHaveClass(/drag-active/);
  await fileDrag(page, 'dragleave', [incoming]);
  await expect(zone).not.toHaveClass(/drag-active/);
  expect(
    (await fileDrag(page, 'drop', [incoming], '.drop-zone')).prevented,
  ).toBe(true);
  await expect(page.getByLabel('Project title')).toHaveValue('Dropped launch');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await zone.focus();
  await zone.press('Enter');
  await (await chooser).setFiles('src/project/fixtures/mixed.takt');
  await expect(page.getByLabel('Project title')).toHaveValue('Autumn α 🌻');
});

test('editor drop preserves edits on Cancel and replaces through the existing guard', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('My unsaved plan');
  await page.getByLabel('Project title').press('Enter');
  await fileDrag(page, 'dragenter', [incoming]);
  await expect(page.getByText('Drop to open your project')).toBeVisible();
  await fileDrag(page, 'drop', [incoming]);
  await expect(page.locator('.drop-overlay')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await fileDrag(page, 'drop', [
    {
      ...incoming,
      bytes: encodeProject({
        ...newProject(),
        title: 'Ignored while guarding',
      }),
    },
  ]);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('My unsaved plan');
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  await fileDrag(page, 'drop', [incoming]);
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Dropped launch');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
});

test('invalid dropped bytes leave the chart and its recovery untouched, and text drags stay native', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('Keep this');
  await page.getByLabel('Project title').press('Enter');
  await fileDrag(page, 'drop', [{ name: 'broken.takt', bytes: '{}' }]);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Project title')).toHaveValue('Keep this');
  const prevented = await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.setData('text/plain', 'Keep this');
    return !document.body.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }),
    );
  });
  expect(prevented).toBe(false);
  await page.reload();
  await page.getByRole('button', { name: /^Keep this/ }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Keep this');
});

test('native Home and editor drops use paths, preserve cancellation, and save to the dropped file', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/desktop.html');
  await nativeDrop(page, {
    type: 'enter',
    paths: ['/projects/project-2.takt'],
  });
  await expect(page.locator('.drop-zone')).toHaveClass(/drag-active/);
  await nativeDrop(page, { type: 'leave' });
  await expect(page.locator('.drop-zone')).not.toHaveClass(/drag-active/);
  await nativeDrop(page, { type: 'drop', paths: ['/projects/project-2.takt'] });
  await expect(page.getByLabel('Project title')).toHaveValue('Project 2');
  await page.getByLabel('Project title').fill('Native dropped edits');
  await page.getByLabel('Project title').press('Enter');
  await page.keyboard.press('Control+s');
  const savedPath = await page.evaluate(
    () =>
      (
        window as unknown as {
          __desktopFixture: {
            state(): { saveCalls: { file: { path: string } }[] };
          };
        }
      ).__desktopFixture
        .state()
        .saveCalls.at(-1)!.file.path,
  );
  expect(savedPath).toBe('/projects/project-2.takt');
  await page.getByLabel('Project title').fill('Unsaved again');
  await page.getByLabel('Project title').press('Enter');
  await page.evaluate(() =>
    (
      window as unknown as {
        __desktopFixture: { external(path: string): void };
      }
    ).__desktopFixture.external('/projects/project-2.takt'),
  );
  await page.keyboard.press('Control+s');
  await expect(
    page.getByRole('heading', { name: 'File changed elsewhere' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await nativeDrop(page, {
    type: 'enter',
    paths: ['/projects/project-3.takt'],
  });
  await expect(page.locator('.drop-overlay')).toBeVisible();
  await nativeDrop(page, { type: 'drop', paths: ['/projects/project-3.takt'] });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Unsaved again');
  await nativeDrop(page, { type: 'drop', paths: ['/projects/project-3.takt'] });
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Project 3');
});

test('drops during a modal or an unfinished native open cannot replace its target', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: 'Dates', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await fileDrag(page, 'dragenter', [incoming]);
  await expect(page.locator('.drop-overlay')).toHaveCount(0);
  expect((await fileDrag(page, 'dragover', [incoming])).effect).toBe('none');
  await fileDrag(page, 'drop', [incoming]);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/tests/fixtures/desktop.html');
  await page.evaluate(() =>
    (
      window as unknown as { __desktopFixture: { deferOpen(): void } }
    ).__desktopFixture.deferOpen(),
  );
  await nativeDrop(page, { type: 'drop', paths: ['/projects/project-2.takt'] });
  await expect(
    page.getByRole('button', { name: 'New project', exact: true }),
  ).toBeDisabled();
  await nativeDrop(page, { type: 'drop', paths: ['/projects/project-3.takt'] });
  await page.evaluate(() =>
    (
      window as unknown as { __desktopFixture: { finishOpen(): void } }
    ).__desktopFixture.finishOpen(),
  );
  await expect(page.getByLabel('Project title')).toHaveValue('Project 2');
});
