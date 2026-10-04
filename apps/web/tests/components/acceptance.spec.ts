import { test, expect } from '@playwright/test';
import { draw, interval, laneGeometry, settled } from '../helpers';

for (const modifier of ['Control', 'Meta']) {
  test(`${modifier}+Z and ${modifier}+Shift+Z recover separate creation and naming actions`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Empty');
    await draw(page, 3, 4, 'Plan');
    await page.keyboard.press(`${modifier}+z`);
    await expect(page.locator('.bar span')).toHaveText('');
    await page.keyboard.press(`${modifier}+z`);
    await expect(page.locator('.bar')).toHaveCount(0);
    await page.keyboard.press(`${modifier}+Shift+z`);
    await interval(page.locator('.bar'), 3, 4);
    await expect(page.locator('.bar span')).toHaveText('');
    await page.keyboard.press(`${modifier}+Shift+z`);
    await expect(page.locator('.bar span')).toHaveText('Plan');
  });
}

test('undoing creation reveals restored collision neighbors even when the created item disappears', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Tall');
  await draw(page, -1, 1);
  await interval(page.getByTestId('bar-a'), 1, 3);
  await page
    .getByRole('button', { name: 'Collapse Unnamed section', exact: true })
    .click();
  await page.keyboard.press('Control+z');
  await interval(page.getByTestId('bar-a'), 0, 2);
  await expect(page.getByTestId('bar-a')).toBeVisible();
  await expect(page.getByTestId('bar-a')).toBeInViewport();
  await expect(page.locator('.bar')).toHaveCount(1);
  await page.keyboard.press('Control+y');
  await interval(page.getByTestId('bar-a'), 1, 3);
  await expect(page.locator('.bar')).toHaveCount(2);
});

for (const kind of ['bar', 'milestone'] as const) {
  test(`redoing ${kind} deletion reveals its former row and time without selecting another item`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Tall');
    const item = page.getByTestId(kind === 'bar' ? 'bar-a' : 'milestone-m');
    await settled(item);
    await item.click({ button: 'right' });
    await page
      .getByRole('menuitem', { name: `Delete ${kind}`, exact: true })
      .click();
    await page.keyboard.press('Control+z');
    await expect(item).toBeVisible();
    await page
      .getByRole('button', { name: 'Collapse Unnamed section', exact: true })
      .click();
    await page.locator('.viewport').focus();
    await page.keyboard.down('Space');
    const lane = await laneGeometry(page);
    await page.mouse.move(lane.x(8), lane.y - 40);
    await page.mouse.down();
    await page.mouse.move(lane.x(0), lane.y - 40);
    await page.mouse.up();
    await page.keyboard.up('Space');
    expect(
      Number(
        await page.getByTestId('lane').first().getAttribute('data-first-week'),
      ),
    ).toBeGreaterThan(5);
    await expect(
      page.getByRole('button', { name: 'Redo', exact: true }),
    ).toBeEnabled();
    await page.keyboard.press('Control+y');
    await expect(item).toHaveCount(0);
    await expect(
      page.getByRole('button', {
        name: 'Collapse Unnamed section',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByTestId('row-row-1')).toBeInViewport();
    const revealed = await laneGeometry(page);
    expect(revealed.x(kind === 'bar' ? 0 : 4)).toBeGreaterThanOrEqual(
      (await page.locator('.viewport').boundingBox())!.x + 218,
    );
    expect(revealed.x(kind === 'bar' ? 2 : 5)).toBeLessThanOrEqual(
      (await page.locator('.viewport').boundingBox())!.x +
        (await page.locator('.viewport').boundingBox())!.width,
    );
    await expect(
      page.locator('.bar.selected, .milestone.selected'),
    ).toHaveCount(0);
  });
}

for (const kind of ['row', 'section'] as const) {
  test(`redoing ${kind} deletion scrolls to the surviving structural context`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=TallSections');
    await page
      .getByRole('button', {
        name: kind === 'row' ? 'Lane 1' : 'Group 1',
        exact: true,
      })
      .click({ button: 'right' });
    await page
      .getByRole('menuitem', { name: `Delete ${kind}…`, exact: true })
      .click();
    await page
      .getByRole('button', { name: `Delete ${kind}`, exact: true })
      .click();
    await page.keyboard.press('Control+z');
    await page
      .getByRole('button', { name: 'Collapse Group 1', exact: true })
      .click();
    await page.locator('.viewport').evaluate((node) => {
      node.scrollTop = 600;
    });
    await page.keyboard.press('Control+y');
    await expect(
      page.getByTestId(kind === 'row' ? 'row-row-1' : 'section-section-1'),
    ).toHaveCount(0);
    await expect(
      page.getByTestId(
        kind === 'row' ? 'section-section-1' : 'section-section-2',
      ),
    ).toBeInViewport();
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('row-row-1')).toBeInViewport();
    await expect(page.getByTestId('bar-a')).toBeVisible();
  });
}

test('the empty hint follows the first visible row and returns after mixed item deletion and undo', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=TallEmpty');
  await expect(page.locator('.hint')).toHaveCount(1);
  await page.locator('.viewport').evaluate((node) => {
    node.scrollTop = 600;
  });
  await expect(page.locator('.hint')).toBeInViewport();
  await page.locator('.viewport').evaluate((node) => {
    node.scrollTop = 0;
  });
  await draw(page, 3, 4);
  const lane = await laneGeometry(page, 1);
  await page.mouse.dblclick(lane.x(2.3), lane.y);
  await page.getByRole('textbox', { name: 'Milestone name' }).press('Escape');
  await expect(page.locator('.hint')).toHaveCount(0);
  await page.keyboard.press('Backspace');
  await expect(page.locator('.hint')).toHaveCount(0);
  await page.locator('.bar').click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.hint')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.hint')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.milestone')).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.hint')).toHaveCount(1);
});
