import { Page } from '@playwright/test';

/**
 * Writes plain text to the browser clipboard so a subsequent paste
 * (e.g. Ctrl+V / ControlOrMeta+v) can be triggered in the UI.
 *
 * Several flows in the app only handle input via a real browser paste
 * (tiptap/ProseMirror editors, prompt inputs), so tests seed the clipboard
 * here and then dispatch the paste keyboard shortcut.
 *
 * Assumes clipboard-write permission is available in the test context.
 *
 * @param page The Playwright page object
 * @param text The text to write to the clipboard
 */
export async function writeTextToClipboard(page: Page, text: string): Promise<void> {
  await page.evaluate(async (value) => {
    await navigator.clipboard.writeText(value);
  }, text);
}
