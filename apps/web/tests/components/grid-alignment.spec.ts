import { test, expect } from '@playwright/test';
import { chooseZoom } from '../helpers';

test('fractional zoom never inserts a stretched week when the row background repeats', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/index.html?state=Empty');
  for (const zoom of ['1.25', '0.75', '0.125', '2']) {
    await chooseZoom(page, zoom);
    const lane = page.getByTestId('lane');
    const weekWidth = Number(await lane.getAttribute('data-week-width'));
    const screenshot = await lane.screenshot();
    const lines = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 4, canvas.width, 1).data;
      const positions: number[] = [];
      let last = -2;
      for (let x = 2; x < canvas.width - 2; x++) {
        if (
          pixels[x * 4] < 252 &&
          pixels[x * 4 + 1] < 253 &&
          pixels[x * 4 + 2] < 254
        ) {
          if (x > last + 1) positions.push(x);
          last = x;
        }
      }
      return positions;
    }, screenshot.toString('base64'));
    expect(lines.length).toBeGreaterThan(5);
    const gaps = lines.slice(1).map((line, index) => line - lines[index]);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(Math.ceil(weekWidth) + 1);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(Math.floor(weekWidth) - 1);
    const laneBounds = (await lane.boundingBox())!;
    const headerBorders = await page
      .locator('.week')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().right),
      );
    for (const border of headerBorders) {
      const x = border - laneBounds.x - 1;
      if (x < 2 || x > laneBounds.width - 2) continue;
      expect(Math.min(...lines.map((line) => Math.abs(line - x)))).toBeLessThan(
        1.1,
      );
    }
  }
});
