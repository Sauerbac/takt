import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { draw, chooseZoom } from '../helpers';

test('title trimming stays outside history and File menu supports keyboard/outside dismissal', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('   ');
  await page.getByLabel('Project title').press('Enter');
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  await page.getByLabel('Project title').fill('  Delivery  ');
  await page.getByLabel('Project title').press('Enter');
  await expect(page.getByLabel('Project title')).toHaveValue('Delivery');
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'File', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: /New project/ }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('menuitem', { name: /Open .takt/ }),
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'File', exact: true }),
  ).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'File', exact: true }).click();
  await page.getByLabel('Project title').click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  await download;
  await chooseZoom(page, '2');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Delivery.*Resume project/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('button', { name: /Delivery/ })).toHaveCount(0);
});

test('Download commits inline naming and cancels reversible gesture previews', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, 0, 2);
  await page.locator('.bar').dblclick();
  await page.getByRole('textbox', { name: 'Bar name' }).fill('Committed draft');
  const first = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  await first;
  await expect(page.locator('.bar').locator('span')).toHaveText(
    'Committed draft',
  );
  const bounds = (await page.locator('.bar').boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 180,
    bounds.y + bounds.height / 2,
    { steps: 3 },
  );
  const second = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  await second;
  await page.mouse.up();
  await expect(page.locator('.bar')).toHaveAttribute('data-start', '0');
  await expect(page.getByTestId('snap-preview')).toHaveCount(0);
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
});

test('Home, title, dirty baseline, guarded replacement, retained Home history and recovery', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Welcome to Takt' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  await draw(page, 0, 2, 'Plan');
  await page.getByLabel('Project title').fill('Launch');
  await page.getByLabel('Project title').press('Enter');
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.bar')).toHaveCount(1);
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  await expect(
    page.getByRole('button', { name: 'Download and continue' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.bar')).toHaveCount(1);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /Launch.*Resume project/ }).click();
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Resume draft' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Launch/ }).click();
  await expect(page.locator('.bar')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('button', { name: /Launch/ })).toHaveCount(0);
});

test('download-and-continue requires acknowledgement and cancellation retains work', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, 0, 2, 'Work');
  await page.keyboard.press('Control+n');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download and continue' }).click();
  await downloaded;
  await expect(page.getByText('Confirm that you retained')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.bar')).toHaveCount(1);
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  await expect(
    page.getByRole('button', { name: 'Download and continue' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.bar')).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith('takt.draft.v1.'))
        .some((key) =>
          JSON.parse(localStorage.getItem(key)!).snapshot.document.bars.some(
            (bar: { name: string }) => bar.name === 'Work',
          ),
        ),
    ),
  ).toBe(true);
  await page.getByLabel('Project title').fill('Modified again');
  await page.keyboard.press('Control+n');
  const next = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download and continue' }).click();
  await next;
  await page
    .getByRole('button', { name: 'I kept the download — Continue' })
    .click();
  await expect(page.locator('.bar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Modified again/ }),
  ).toHaveCount(0);
});

test('invalid files and picker cancellation preserve chart and recovery', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, 0, 2, 'Keep');
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  await (
    await chooser
  ).setFiles({
    name: 'invalid.takt',
    mimeType: 'application/json',
    buffer: Buffer.from('{"format":"takt","version":999}'),
  });
  await expect(page.getByRole('alert')).toContainText('unsupported');
  await expect(page.locator('.bar')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => {
    const native = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.type === 'file') this.dispatchEvent(new Event('cancel'));
      else native.call(this);
    };
  });
  await page.keyboard.press('Control+o');
  await expect(page.locator('.bar')).toHaveCount(1);
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
});

test('unavailable recovery warns persistently, allows editing/download and Retry', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('Quota full', 'QuotaExceededError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, 0, 2, 'Still here');
  await expect(
    page.getByRole('status').filter({ hasText: 'Recovery is unavailable' }),
  ).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  await downloaded;
  await expect(
    page.getByRole('button', { name: 'Retry', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.bar')).toHaveCount(1);
});

test('two tabs keep distinct drafts and resuming a foreign draft never overwrites its owner', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('First tab');
  await page.getByLabel('Project title').press('Enter');
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('button', { name: /First tab/ })).toBeVisible();
  await page.getByLabel('Project title').fill('Latest live tab');
  await page.getByLabel('Project title').press('Enter');
  await other.getByRole('button', { name: /First tab/ }).click();
  await expect(other.getByLabel('Project title')).toHaveValue(
    'Latest live tab',
  );
  await page.getByLabel('Project title').fill('First tab');
  await page.getByLabel('Project title').press('Enter');
  await other.getByLabel('Project title').fill('Second tab');
  await other.getByLabel('Project title').press('Enter');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /First tab.*Resume project/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Second tab/ })).toBeVisible();
  await other.keyboard.press('Control+n');
  await other
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await page.reload();
  await expect(page.getByRole('button', { name: /First tab/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Second tab/ })).toHaveCount(0);
});

test('an abandoned browser draft is claimed in place and deliberate discard removes the original recovery', async ({
  page,
  context,
}) => {
  const original = await context.newPage();
  await original.goto('/');
  await original
    .getByRole('button', { name: 'New project', exact: true })
    .click();
  await original.getByLabel('Project title').fill('Abandoned work');
  await original.getByLabel('Project title').press('Enter');
  await expect
    .poll(() =>
      original.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith('takt.draft.v1.'))
          .some(
            (key) =>
              JSON.parse(localStorage.getItem(key)!).snapshot.title ===
              'Abandoned work',
          ),
      ),
    )
    .toBe(true);
  await original.close();
  await page.goto('/');
  await page.getByRole('button', { name: /Abandoned work/ }).click();
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page.getByLabel('Project title')).toHaveValue('Untitled');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Abandoned work/ }),
  ).toHaveCount(0);
});

test('an invalid cached recovery claim preserves the current chart and its recovery', async ({
  page,
  context,
}) => {
  const source = await context.newPage();
  await source.goto('/');
  await source
    .getByRole('button', { name: 'New project', exact: true })
    .click();
  await source.getByLabel('Project title').fill('Cached source');
  await source.getByLabel('Project title').press('Enter');
  await source.close();
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('Retained current');
  await page.getByLabel('Project title').press('Enter');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Cached source/ }),
  ).toBeVisible();
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage).filter((key) =>
      key.startsWith('takt.draft.v1.'),
    )) {
      const record = JSON.parse(localStorage.getItem(key)!);
      if (record.snapshot.title === 'Cached source') {
        record.snapshot.version = 999;
        localStorage.setItem(key, JSON.stringify(record));
      }
    }
  });
  await page.getByRole('button', { name: /Cached source/ }).click();
  await expect(page.getByRole('alert')).toContainText('unsupported');
  await expect(
    page.getByRole('button', { name: /Retained current.*Resume project/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith('takt.draft.v1.'))
        .some(
          (key) =>
            JSON.parse(localStorage.getItem(key)!).snapshot.title ===
            'Retained current',
        ),
    ),
  ).toBe(true);
});

test('cancelling a staged recovery frees its source for another tab without creating a duplicate', async ({
  page,
  context,
}) => {
  const source = await context.newPage();
  await source.goto('/');
  await source
    .getByRole('button', { name: 'New project', exact: true })
    .click();
  await source.getByLabel('Project title').fill('Released source');
  await source.getByLabel('Project title').press('Enter');
  await expect
    .poll(() =>
      source.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith('takt.draft.v1.'))
          .some(
            (key) =>
              JSON.parse(localStorage.getItem(key)!).snapshot.title ===
              'Released source',
          ),
      ),
    )
    .toBe(true);
  await source.close();
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Project title').fill('Retained chart');
  await page.getByLabel('Project title').press('Enter');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith('takt.draft.v1.'))
          .some(
            (key) =>
              JSON.parse(localStorage.getItem(key)!).snapshot.title ===
              'Retained chart',
          ),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: /Released source/ }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const next = await context.newPage();
  await next.goto('/');
  await next.getByRole('button', { name: /Released source/ }).click();
  await expect(next.getByLabel('Project title')).toHaveValue('Released source');
  await expect(next.getByLabel('Modified', { exact: true })).toBeVisible();
  await next.keyboard.press('Control+n');
  await next
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await next.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    next.getByRole('button', { name: /Released source/ }),
  ).toHaveCount(0);
  await expect(
    next.getByRole('button', { name: /Retained chart/ }),
  ).toBeVisible();
});

test('editor shortcuts leave the retained chart alone on Home and behind shell dialogs', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, 0, 2, 'Keep');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to Takt' }),
  ).toBeVisible();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.getByRole('button', { name: /Untitled.*Resume project/ }).click();
  await expect(page.locator('.bar')).toHaveCount(1);
  await expect(page.locator('.bar').locator('span')).toHaveText('Keep');
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  await page.keyboard.press('Control+n');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Control+z');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.bar')).toHaveCount(1);
  await expect(page.locator('.bar').locator('span')).toHaveText('Keep');
});

test('recovery is written for edits, not for every scroll step or drag preview', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, 0, 2, 'Work');
  const draft = () =>
    page.evaluate(() => {
      const key = Object.keys(localStorage).find((key) =>
        key.startsWith('takt.draft.v1.'),
      )!;
      return JSON.parse(localStorage.getItem(key)!).snapshot;
    });
  await expect.poll(async () => (await draft()).document.bars.length).toBe(1);
  await page.evaluate(() => {
    const counter = window as unknown as { __draftWrites: number };
    counter.__draftWrites = 0;
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('takt.draft.v1.')) counter.__draftWrites++;
      native.call(this, key, value);
    };
  });
  const writes = () =>
    page.evaluate(
      () => (window as unknown as { __draftWrites: number }).__draftWrites,
    );
  const lane = (await page.getByTestId('lane').first().boundingBox())!;
  await page.mouse.move(lane.x + 300, lane.y + 22);
  for (let step = 0; step < 30; step++) await page.mouse.wheel(-6, 0);
  expect(await writes()).toBeLessThanOrEqual(2);
  await expect.poll(async () => (await draft()).view.firstWeek).not.toBe(-2);
  const afterScroll = await writes();
  expect(afterScroll).toBeLessThanOrEqual(3);
  const bar = (await page.locator('.bar').boundingBox())!;
  await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2 + 200, bar.y + bar.height / 2, {
    steps: 20,
  });
  expect(await writes()).toBe(afterScroll);
  await page.mouse.up();
  await expect(page.locator('.bar')).not.toHaveAttribute('data-start', '0');
  await expect.poll(writes).toBe(afterScroll + 1);
  await page.mouse.move(lane.x + 300, lane.y + 22);
  await page.mouse.wheel(-200, 0);
  const scrolled = await page
    .getByTestId('lane')
    .first()
    .getAttribute('data-first-week');
  await page.reload();
  expect(String((await draft()).view.firstWeek)).toBe(scrolled);
});

test('an overscrolled viewport still yields a valid view and modified state', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, 0, 2, 'Work');
  await page.locator('.viewport').evaluate((viewport) => {
    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => -5,
      set: () => {},
    });
    viewport.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByLabel('Modified', { exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const saved = JSON.parse(
    await readFile(await (await downloading).path(), 'utf8'),
  );
  expect(saved.view.scrollTop).toBe(0);
  await expect(page.getByLabel('Modified', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

const draftKeys = (page: Page) =>
  page.evaluate(
    () =>
      Object.keys(localStorage).filter((key) =>
        key.startsWith('takt.draft.v1.'),
      ).length,
  );

test('an untouched project leaves no draft; the first edit creates one', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await chooseZoom(page, '2');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Untitled.*Resume project/ }),
  ).toBeVisible();
  expect(await draftKeys(page)).toBe(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Room for what’s next' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await draw(page, 0, 2, 'First edit');
  await expect.poll(() => draftKeys(page)).toBe(1);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Resume draft' }),
  ).toBeVisible();
});

test('a draft can be deleted from Home after confirmation, but not while another tab has it open', async ({
  page,
  context,
}) => {
  const source = await context.newPage();
  await source.goto('/');
  await source
    .getByRole('button', { name: 'New project', exact: true })
    .click();
  await source.getByLabel('Project title').fill('Old plan');
  await source.getByLabel('Project title').press('Enter');
  await expect.poll(() => draftKeys(source)).toBe(1);
  await page.goto('/');
  const entry = page.getByRole('button', { name: /^Old plan/ });
  const remove = page.getByRole('button', { name: /^Delete Old plan from/ });
  await expect(entry).toBeVisible();
  await entry.hover();
  await remove.click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('open in another tab');
  await expect(entry).toBeVisible();
  expect(await draftKeys(page)).toBe(1);
  await source.close();
  await page.getByRole('button', { name: 'Dismiss error' }).click();
  await remove.click();
  await expect(
    page.getByRole('heading', { name: 'Delete this draft?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(entry).toBeVisible();
  await remove.click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(entry).toHaveCount(0);
  expect(await draftKeys(page)).toBe(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
