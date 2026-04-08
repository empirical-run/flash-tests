import { test, expect } from "./fixtures";
import { navigateToSessions } from "./pages/sessions";

const LOOM_URL = "https://www.loom.com/share/883f92af399642b1a073e88d4f2bfd07";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\/[^\s\n]+/;

test.describe('Loom Video', () => {
  test('Able to download Loom videos', async ({ page }) => {
    await navigateToSessions(page);
    await page.locator('button:has(svg.lucide-plus)').click();

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    // Simulate pasting the Loom URL as text.
    // The app's onPaste handler intercepts the event, detects the Loom URL pattern,
    // calls preventDefault() (so the raw URL is NOT inserted as plain text),
    // then downloads the video and replaces the content with a dashboard-uploads link.
    // We dispatch a ClipboardEvent with text/plain data to trigger this flow.
    await textarea.focus();
    await textarea.evaluate((element, url) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', url);
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'clipboardData', {
        value: dt,
        writable: false,
        enumerable: true,
        configurable: false,
      });
      element.dispatchEvent(event);
    }, LOOM_URL);

    // The app downloads the Loom video and converts the URL to a dashboard-uploads link.
    // Wait up to 60 s because the server needs to fetch the video from Loom.
    await expect(textarea).toContainText(UPLOAD_URL_REGEX, { timeout: 60000 });

    // Extract the dashboard-uploads URL from the textarea value
    const textareaValue = await textarea.inputValue();
    const uploadUrlMatch = textareaValue.match(/(https:\/\/dashboard-uploads\.empirical\.run\/[^\s\n]+)/);
    expect(uploadUrlMatch).not.toBeNull();
    const uploadUrl = uploadUrlMatch![1];

    // Verify the URL serves a playable video by checking the HTTP content-type
    const response = await page.request.head(uploadUrl);
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/^video\//);
  });
});
