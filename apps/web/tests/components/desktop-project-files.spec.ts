import { test, expect, type Page } from '@playwright/test';
import type { controls } from '../fixtures/desktop';
type DesktopWindow = Window & { __desktopFixture: typeof controls };
async function control(
  page: Page,
  action: (fixture: typeof controls) => unknown,
) {
  const expression = action.toString();
  return page.evaluate((expression) => {
    const fixture = (window as unknown as DesktopWindow).__desktopFixture;
    return Function('fixture', `return (${expression})(fixture)`)(fixture);
  }, expression);
}
async function fixture(page: Page, recovery = false) {
  await page.goto(
    `/tests/fixtures/desktop.html${recovery ? '?recovery=1' : ''}`,
  );
  await expect(
    page.getByRole('button', { name: 'New project', exact: true }),
  ).toBeVisible();
}
async function edit(page: Page, title = 'Local edits') {
  await page.getByLabel('Project title').fill(title);
  await page.getByLabel('Project title').press('Enter');
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
}
async function fileAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'File', exact: false }).click();
  await page.getByRole('menuitem', { name, exact: false }).click();
}
async function opened(page: Page) {
  await fixture(page);
  await page
    .getByRole('button', { name: 'Open .takt file', exact: true })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Project 1');
}

test('desktop Home retains all recents and removing entries leaves files intact', async ({
  page,
}) => {
  await fixture(page);
  await expect(page.locator('.recent-entry')).toHaveCount(10);
  await page.getByRole('button', { name: /Show all/ }).click();
  await expect(page.locator('.recent-entry')).toHaveCount(12);
  await page.getByRole('button', { name: /Remove.*project-1.takt/ }).click();
  await expect(page.locator('.recent-entry')).toHaveCount(11);
  expect(
    await control(
      page,
      (fixture) => !!fixture.state().files['/projects/project-1.takt'],
    ),
  ).toBe(true);
});

test('desktop Home/New guards preserve edits after Cancel, cancelled Save, failed Save and allow Discard', async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await edit(page);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Local edits');
  await page.keyboard.press('Control+n');
  await control(page, (fixture) => fixture.queueSave('cancelled'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Project title')).toHaveValue('Local edits');
  await control(page, (fixture) => fixture.queueSave('failure'));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('disk is full');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
});

test('Save As switches the active path and subsequent Save writes that file', async ({
  page,
}) => {
  await opened(page);
  await edit(page, 'Copy work');
  await fileAction(page, 'Save As');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  await edit(page, 'Copy updated');
  await page.keyboard.press('Control+s');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  const state = await control(page, (fixture) => fixture.state());
  expect(state.files['/projects/project-1.takt'].snapshot.title).toBe(
    'Project 1',
  );
  expect(state.files['/projects/copy.takt'].snapshot.title).toBe(
    'Copy updated',
  );
  expect(state.saveCalls.at(-1).file.path).toBe('/projects/copy.takt');
});

test('external conflict Cancel and second reload warning retain edits, confirmed reload uses their version', async ({
  page,
}) => {
  await opened(page);
  await edit(page);
  await control(page, (fixture) =>
    fixture.external('/projects/project-1.takt'),
  );
  await page.keyboard.press('Control+s');
  await expect(
    page.getByRole('heading', { name: 'File changed elsewhere' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Local edits');
  await page.keyboard.press('Control+s');
  await page
    .getByRole('button', { name: 'Reload their version', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Replace local changes?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Local edits');
  await page.keyboard.press('Control+s');
  await page
    .getByRole('button', { name: 'Reload their version', exact: true })
    .click();
  await page
    .getByRole('button', {
      name: 'Reload and replace local changes',
      exact: true,
    })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Their version');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
});

test('conflict Save another and Overwrite preserve their explicit file outcomes', async ({
  page,
}) => {
  await opened(page);
  await edit(page);
  await control(page, (fixture) =>
    fixture.external('/projects/project-1.takt'),
  );
  await page.keyboard.press('Control+s');
  await page
    .getByRole('button', { name: 'Save my work as another file', exact: true })
    .click();
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  let state = await control(page, (fixture) => fixture.state());
  expect(state.files['/projects/project-1.takt'].snapshot.title).toBe(
    'Their version',
  );
  expect(state.files['/projects/copy.takt'].snapshot.title).toBe('Local edits');
  await edit(page, 'Overwrite copy');
  await control(page, (fixture) => fixture.external('/projects/copy.takt'));
  await page.keyboard.press('Control+s');
  await page.getByRole('button', { name: 'Overwrite', exact: true }).click();
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  state = await control(page, (fixture) => fixture.state());
  expect(state.files['/projects/copy.takt'].snapshot.title).toBe(
    'Overwrite copy',
  );
  expect(state.saveCalls.at(-1).options.overwrite).toBe(true);
});

test('cancelling an asynchronous reload prevents its late completion replacing local edits', async ({
  page,
}) => {
  await opened(page);
  await edit(page);
  await control(page, (fixture) =>
    fixture.external('/projects/project-1.takt'),
  );
  await page.keyboard.press('Control+s');
  await page
    .getByRole('button', { name: 'Reload their version', exact: true })
    .click();
  await control(page, (fixture) => fixture.deferOpen());
  await page
    .getByRole('button', {
      name: 'Reload and replace local changes',
      exact: true,
    })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await control(page, (fixture) => fixture.finishOpen());
  await expect(page.getByLabel('Project title')).toHaveValue('Local edits');
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
});

test('unavailable recent offers Locate/Remove/Cancel and valid Locate repairs the entry', async ({
  page,
}) => {
  await fixture(page);
  await control(page, (fixture) =>
    fixture.deleteFile('/projects/project-1.takt'),
  );
  await page
    .getByRole('button', { name: /project-1.takt.*\/projects/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'File unavailable' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.recent-entry')).toHaveCount(10);
  await page
    .getByRole('button', { name: /project-1.takt.*\/projects/ })
    .click();
  await control(page, (fixture) =>
    fixture.queueOpen('success', '/projects/project-2.takt'),
  );
  await page.getByRole('button', { name: 'Locate file', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Project 2');
  expect(
    await control(page, (fixture) =>
      fixture
        .state()
        .recents.some((item) => item.path === '/projects/project-1.takt'),
    ),
  ).toBe(false);
});

test('recovery opens modified preserving original revision and native close guard Cancel/Discard', async ({
  page,
}) => {
  await fixture(page, true);
  await page.getByRole('button', { name: /^Recovered work/ }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Recovered work');
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  await control(page, (fixture) =>
    fixture.external('/projects/project-1.takt'),
  );
  await page.keyboard.press('Control+s');
  await expect(
    page.getByRole('heading', { name: 'File changed elsewhere' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const cancelled = control(page, (fixture) => fixture.requestClose());
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await cancelled).toBe(false);
  const discarded = control(page, (fixture) => fixture.requestClose());
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  expect(await discarded).toBe(true);
  expect(
    await control(
      page,
      (fixture) =>
        fixture.state().files['/projects/project-1.takt'].snapshot.title,
    ),
  ).toBe('Their version');
  expect(
    await control(page, (fixture) =>
      fixture
        .state()
        .recovery.some((record) => record.id === 'interrupted-session'),
    ),
  ).toBe(false);
});

test('cancelling Discard while recovery removal is pending restores recovery and preserves current edits', async ({
  page,
}) => {
  await opened(page);
  await edit(page);
  await page.keyboard.press('Control+n');
  await control(page, (fixture) => fixture.deferRemove());
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await control(page, (fixture) => fixture.finishRemove());
  await expect(page.getByLabel('Project title')).toHaveValue('Local edits');
  await expect
    .poll(() =>
      control(page, (fixture) =>
        fixture
          .state()
          .recovery.some((record) => record.snapshot.title === 'Local edits'),
      ),
    )
    .toBe(true);
});

test('successful Save and conflict Save another complete a pending guarded Open', async ({
  page,
}) => {
  await opened(page);
  await edit(page);
  await control(page, (fixture) =>
    fixture.queueOpen('success', '/projects/project-2.takt'),
  );
  await page.keyboard.press('Control+o');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Project 2');
  await edit(page, 'Second local edits');
  await control(page, (fixture) => {
    fixture.external('/projects/project-2.takt');
    fixture.queueOpen('success', '/projects/project-3.takt');
  });
  await page.keyboard.press('Control+o');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page
    .getByRole('button', { name: 'Save my work as another file', exact: true })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Project 3');
  expect(
    await control(
      page,
      (fixture) => fixture.state().files['/projects/copy.takt'].snapshot.title,
    ),
  ).toBe('Second local edits');
});

test('the window still closes when its recovery copy cannot be removed', async ({
  page,
}) => {
  await fixture(page);
  await control(page, (fixture) => fixture.failRemove());
  expect(await control(page, (fixture) => fixture.requestClose())).toBe(true);
  await control(page, (fixture) => fixture.failRemove(false));
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await edit(page);
  await control(page, (fixture) => fixture.failRemove());
  const cancelled = control(page, (fixture) => fixture.requestClose());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await cancelled).toBe(false);
  const discarded = control(page, (fixture) => fixture.requestClose());
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  expect(await discarded).toBe(true);
});

test('unsaved work can be deleted from desktop Home after confirmation', async ({
  page,
}) => {
  await fixture(page, true);
  await page.getByRole('button', { name: /^Delete Recovered work/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Delete unsaved work?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /^Recovered work/ }),
  ).toHaveCount(0);
  expect(await control(page, (fixture) => fixture.state().recovery)).toEqual(
    [],
  );
  expect(
    await control(
      page,
      (fixture) => !!fixture.state().files['/projects/project-1.takt'],
    ),
  ).toBe(true);
});

test('an opened file has no recovery copy until it is edited', async ({
  page,
}) => {
  await opened(page);
  await fileAction(page, 'Home');
  expect(await control(page, (fixture) => fixture.state().recovery)).toEqual(
    [],
  );
  await page
    .getByRole('button', { name: 'Open .takt file', exact: true })
    .click();
  await edit(page);
  await expect
    .poll(() => control(page, (fixture) => fixture.state().recovery.length))
    .toBe(1);
});

test('a recent file that is not a valid project offers removal, not Locate', async ({
  page,
}) => {
  await fixture(page);
  await control(page, (fixture) =>
    fixture.corruptFile('/projects/project-2.takt'),
  );
  await page
    .getByRole('button', { name: /project-2.takt.*\/projects/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'File can’t be opened' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Locate file' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.recent-entry')).toHaveCount(10);
  await page
    .getByRole('button', { name: /project-2.takt.*\/projects/ })
    .click();
  await page
    .getByRole('button', { name: 'Remove from recents', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: /project-2.takt.*\/projects/ }),
  ).toHaveCount(0);
  expect(
    await control(
      page,
      (fixture) => !!fixture.state().files['/projects/project-2.takt'],
    ),
  ).toBe(true);
});

test('a file enters recents when it replaces the project, not when its guard is cancelled', async ({
  page,
}) => {
  await fixture(page);
  await control(page, (fixture) =>
    fixture.addFile('/elsewhere/picked.takt', 'Picked'),
  );
  const remembered = () =>
    control(page, (fixture) =>
      fixture
        .state()
        .recents.some((item) => item.path === '/elsewhere/picked.takt'),
    );
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await edit(page);
  await control(page, (fixture) =>
    fixture.queueOpen('success', '/elsewhere/picked.takt'),
  );
  await page.keyboard.press('Control+o');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await remembered()).toBe(false);
  await control(page, (fixture) =>
    fixture.queueOpen('success', '/elsewhere/picked.takt'),
  );
  await page.keyboard.press('Control+o');
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Picked');
  await expect.poll(remembered).toBe(true);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.locator('.recent-entry').first()).toContainText(
    'picked.takt',
  );
});
