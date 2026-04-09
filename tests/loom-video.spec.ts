import { test, expect } from "./fixtures";
import { navigateToSessions } from "./pages/sessions";

const LOOM_URL = "https://www.loom.com/share/883f92af399642b1a073e88d4f2bfd07";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\/[^\s\n]+/;

test.describe('Loom Video', () => {
  test('Able to download Loom videos', async ({ page }) => {
    await navigateToSessions(page);
    await page.locator('button:has(svg.lucide-plus)').click();

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    // Simulate pasting the Loom URL by dispatching a ClipboardEvent with the URL
    // as text/plain content. The app's onPaste handler detects the Loom URL pattern,
    // calls event.preventDefault() to suppress raw text insertion, then POSTs to
    // /api/upload/loom to download and re-host the video on dashboard-uploads.
    await textarea.focus();
    await textarea.evaluate((element, url) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', url);
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'clipboardData', {
        value: dt,
        writable: false,
        enumerable: true,
        configurable: false,
      });
      element.dispatchEvent(event);
    }, LOOM_URL);

    // While downloading, the app shows a "Downloading Loom video..." indicator
    await expect(page.getByText('Downloading Loom video...')).toBeVisible();

    // After the download completes the textarea shows the URL as a pill link
    await expect(textarea).toContainText(UPLOAD_URL_REGEX, { timeout: 60000 });

    // Extract the dashboard-uploads URL from the pill link inside the tiptap editor
    const uploadUrl = await textarea.locator('a').first().getAttribute('href');
    expect(uploadUrl).toBeTruthy();
    expect(uploadUrl).toMatch(UPLOAD_URL_REGEX);

    // Verify the URL actually serves a playable video (correct content-type header)
    const response = await page.request.head(uploadUrl);
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/^video\//);
  });
});
