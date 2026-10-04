import { test, expect } from '@playwright/test';
import { laneGeometry, pauseClock } from '../helpers';

for (const scale of ['0.5', '2']) {
  test(`zoom and fractional Space-pan at ${Number(scale) * 100}% attach every timeline item immediately without settlement lag`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=CalendarColors');
    await pauseClock(page);
    await page
      .getByRole('combobox', { name: 'Zoom', exact: true })
      .selectOption(scale);
    const lane = await laneGeometry(page, 1);
    const bar = page.getByTestId('bar-c');
    const milestone = page.getByTestId('milestone-m');
    const barBounds = (await bar.boundingBox())!;
    const milestoneBounds = (await milestone.boundingBox())!;
    expect(barBounds.x).toBeCloseTo(lane.x(3) + 5, 0);
    expect(barBounds.width).toBeCloseTo(2 * lane.width - 10, 0);
    expect(milestoneBounds.x).toBeCloseTo(lane.x(5), 0);
    expect(await bar.evaluate((node) => node.getAnimations().length)).toBe(0);
    await page.clock.runFor(48);
    const viewport = page.getByRole('region', {
      name: 'Whole-week Gantt chart',
      exact: true,
    });
    await viewport.focus();
    await page.keyboard.down('Space');
    const x = Math.round(barBounds.x + barBounds.width / 2);
    await page.mouse.move(x, lane.y);
    await page.mouse.down();
    for (const delta of [17, -13, 0]) {
      await page.mouse.move(x + delta, lane.y);
      expect((await bar.boundingBox())!.x).toBeCloseTo(barBounds.x + delta, 0);
      expect((await milestone.boundingBox())!.x).toBeCloseTo(
        milestoneBounds.x + delta,
        0,
      );
      expect(await bar.evaluate((node) => node.getAnimations().length)).toBe(0);
    }
    await page.mouse.up();
    await page.keyboard.up('Space');
    await expect(bar).toHaveAttribute('data-start', '3');
    await expect(milestone).toHaveAttribute('data-boundary', '5');
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeDisabled();
  });
}

for (const interruption of ['pointercancel', 'lostpointercapture', 'blur']) {
  test(`Space-pan stops after ${interruption} and the next ordinary drag still creates a bar`, async ({
    page,
  }) => {
    await page.goto('/tests/fixtures/index.html?state=Empty');
    const viewport = page.getByRole('region', {
      name: 'Whole-week Gantt chart',
      exact: true,
    });
    await viewport.focus();
    const lane = await laneGeometry(page);
    await page.keyboard.down('Space');
    await page.mouse.move(lane.x(4), lane.y);
    await page.mouse.down();
    await page.mouse.move(lane.x(4) + 37, lane.y);
    if (interruption === 'blur')
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else await viewport.dispatchEvent(interruption);
    await page.mouse.up();
    await page.keyboard.up('Space');
    await expect(viewport).not.toHaveClass(/panning|pannable/);
    await expect(
      page.getByRole('button', { name: 'Undo', exact: true }),
    ).toBeDisabled();
    const after = await laneGeometry(page);
    await page.mouse.move(after.x(1), after.y);
    await page.mouse.down();
    await page.mouse.move(after.x(3), after.y);
    await page.mouse.up();
    await expect(
      page.getByRole('textbox', { name: 'Bar name', exact: true }),
    ).toBeFocused();
    await page
      .getByRole('textbox', { name: 'Bar name', exact: true })
      .press('Escape');
    await expect(page.locator('.bar')).toHaveAttribute('data-start', '1');
    await expect(page.locator('.bar')).toHaveAttribute('data-end', '3');
  });
}
