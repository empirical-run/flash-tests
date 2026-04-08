import { test, expect } from "./fixtures";
import { navigateToSessions } from "./pages/sessions";

const LOOM_URL = "https://www.loom.com/share/883f92af399642b1a073e88d4f2bfd07";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\/[^\s\n]+/;

test.describe('Loom Video', () => {
  /**
   * When a Loom share URL is pasted into the session creation textarea, the app
   * should detect it, download the video, upload it to dashboard-uploads, and
   * replace the raw URL with an "Uploaded: <dashboard-uploads-url>" entry.
   * The resulting link should serve a playable video file.
   */
  test('Able to download Loom videos', async ({ page }) => {
    await navigateToSessions(page);
    await page.locator('button:has(svg.lucide-plus)').click();

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    // Paste the Loom URL via the clipboard so the app's onPaste handler can detect
    // it as a Loom share link and trigger the server-side video download flow.
    await page.evaluate(url => navigator.clipboard.writeText(url), LOOM_URL);
    await textarea.click();
    await page.keyboard.press('Control+V');

    // The app should detect the Loom URL, download the video, and replace the
    // raw Loom URL with a dashboard-uploads.empirical.run link.
    // This involves a server round-trip so allow up to 60 s.
    await expect(textarea).toContainText(UPLOAD_URL_REGEX, { timeout: 60000 });

    // Extract the dashboard-uploads URL from the textarea value
    const textareaValue = await textarea.inputValue();
    const uploadUrlMatch = textareaValue.match(/(https:\/\/dashboard-uploads\.empirical\.run\/[^\s\n]+)/);
    expect(uploadUrlMatch).not.toBeNull();
    const uploadUrl = uploadUrlMatch![1];

    // Verify the uploaded URL actually serves a playable video (correct content-type)
    const response = await page.request.head(uploadUrl);
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/^video\//);
  });
});
