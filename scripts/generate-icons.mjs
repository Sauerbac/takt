import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const source = await readFile(
  new URL('../apps/web/src/assets/takt-icon.svg', import.meta.url),
  'utf8',
);
const destination = new URL('../apps/web/public/', import.meta.url);
await mkdir(destination, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const render = async (size) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0}img{display:block;width:${size}px;height:${size}px}</style><img alt="" src="data:image/svg+xml,${encodeURIComponent(source)}">`,
    );
    await page.locator('img').evaluate((image) => image.decode());
    return page.screenshot({ omitBackground: true });
  };

  // Windows reads a 256 px entry for large Explorer views; browsers need only the small ones.
  const writeIco = async (target, sizes) => {
    const images = [];
    for (const size of sizes) images.push(await render(size));
    const directory = Buffer.alloc(6 + 16 * sizes.length);
    directory.writeUInt16LE(1, 2);
    directory.writeUInt16LE(sizes.length, 4);
    let offset = directory.length;
    for (const [index, size] of sizes.entries()) {
      const entry = 6 + index * 16;
      directory[entry] = size % 256;
      directory[entry + 1] = size % 256;
      directory.writeUInt16LE(1, entry + 4);
      directory.writeUInt16LE(32, entry + 6);
      directory.writeUInt32LE(images[index].length, entry + 8);
      directory.writeUInt32LE(offset, entry + 12);
      offset += images[index].length;
    }
    await writeFile(target, Buffer.concat([directory, ...images]));
  };

  await writeIco(new URL('favicon.ico', destination), [16, 32, 48]);
  const desktopIcons = new URL(
    '../apps/desktop/src-tauri/icons/',
    import.meta.url,
  );
  await mkdir(desktopIcons, { recursive: true });
  await writeIco(new URL('icon.ico', desktopIcons), [16, 24, 32, 48, 64, 256]);
  await writeFile(new URL('app-icon.png', destination), await render(512));
  console.log(
    'Generated favicon.ico (16, 32, 48 px), the desktop icon.ico (16 to 256 px) and app-icon.png (512 px).',
  );
} finally {
  await browser.close();
}
