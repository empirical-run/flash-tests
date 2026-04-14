import { test, expect } from "./fixtures";
import { navigateToSessions, openNewSessionDialog } from "./pages/sessions";

test.describe('Prompt Input', () => {
  test('plain text paste into new session dialog prompt input', async ({ page }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const promptInput = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');
    await expect(promptInput).toBeVisible();

    // Write text to clipboard and paste it into the prompt input
    const textToPaste = 'hello from clipboard paste';
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, textToPaste);

    await promptInput.click();
    await page.keyboard.press('ControlOrMeta+v');

    // Verify the pasted text appears in the input
    await expect(promptInput).toContainText(textToPaste);

    // Dismiss the dialog without creating a session
    await page.keyboard.press('Escape');
    await expect(promptInput).not.toBeVisible();
  });

  test('rich HTML paste into new session dialog prompt input', async ({ page }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const promptInput = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');
    await expect(promptInput).toBeVisible();

    // Write rich HTML content to the clipboard (simulates copy from a webpage or doc)
    const plainText = 'hello from rich paste';
    const htmlContent = '<b>hello</b> from <i>rich</i> paste';
    await page.evaluate(async ({ plain, html }) => {
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      });
      await navigator.clipboard.write([clipboardItem]);
    }, { plain: plainText, html: htmlContent });

    await promptInput.click();
    await page.keyboard.press('ControlOrMeta+v');

    // Verify the text content appears in the input (formatting may be stripped)
    await expect(promptInput).toContainText(plainText);

    // Dismiss the dialog without creating a session
    await page.keyboard.press('Escape');
    await expect(promptInput).not.toBeVisible();
  });
});
