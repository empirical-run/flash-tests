import { test, expect } from "./fixtures";
import { navigateToSessions } from "./pages/sessions";

const LOOM_URL = "https://www.loom.com/share/883f92af399642b1a073e88d4f2bfd07";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\/[^\s\n]+/;

test.describe('Loom Video', () => {
  test('Able to download Loom videos', async ({ page }) => {
    await navigateToSessions(page);
    await page.locator('button:has(svg.lucide-plus)').click();

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    // Paste the Loom URL into the tiptap editor.
    // The tiptap editor processes paste via ProseMirror's handlePaste extension, which
    // requires a real browser paste (Ctrl+V). We write the URL to the clipboard first,
    // then trigger Ctrl+V so the app's Loom URL detection handler fires correctly.
    await page.evaluate(async (url) => {
      await navigator.clipboard.writeText(url);
    }, LOOM_URL);
    await textarea.click();
    await page.keyboard.press('Control+v');

    // While downloading, the app shows a "Loom video" loading indicator below the editor
    await expect(page.getByText('Loom video')).toBeVisible();

    // After the download completes the textarea shows the URL as a pill link
    await expect(textarea).toContainText(UPLOAD_URL_REGEX, { timeout: 60000 });

    // Extract the dashboard-uploads URL from the pill link inside the tiptap editor
    const uploadUrl = await textarea.locator('a').first().getAttribute('href');
    expect(uploadUrl).toBeTruthy();
    expect(uploadUrl).toMatch(UPLOAD_URL_REGEX);

    // Verify the URL actually serves a playable video (correct content-type header)
    const response = await page.request.head(uploadUrl!);
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/^video\//);
  });
});
