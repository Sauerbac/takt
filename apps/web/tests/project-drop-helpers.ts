import type { Page } from '@playwright/test';
import type { ProjectFileDrop } from '../src/project/platform';

export async function fileDrag(
  page: Page,
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  files: { name: string; bytes: string }[],
  selector = 'body',
) {
  return page.evaluate(
    ({ type, files, selector }) => {
      const transfer = new DataTransfer();
      for (const file of files)
        transfer.items.add(
          new File([file.bytes], file.name, { type: 'application/json' }),
        );
      const event = new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      });
      const accepted = document.querySelector(selector)!.dispatchEvent(event);
      return { prevented: !accepted, effect: transfer.dropEffect };
    },
    { type, files, selector },
  );
}

export async function nativeDrop(page: Page, event: ProjectFileDrop) {
  await page.evaluate((event) => {
    (
      window as unknown as {
        __desktopFixture: { fileDrop(event: ProjectFileDrop): void };
      }
    ).__desktopFixture.fileDrop(event);
  }, event);
}
