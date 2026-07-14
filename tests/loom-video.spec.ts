import { test, expect } from "./fixtures";
import { getInitialPromptInput, navigateToSessions, openNewSessionDialog } from "./pages/sessions";

const LOOM_URL = "https://www.loom.com/share/883f92af399642b1a073e88d4f2bfd07";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\/[^\s\n]+/;

test.describe('Loom Video', () => {
  test('Able to download Loom videos', async ({ page }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const textarea = getInitialPromptInput(page);

    // The app downloads the Loom video via POST /api/upload/loom and returns the
    // re-hosted dashboard-uploads URL in the JSON response. Capture that response to
    // read the uploaded URL — the new prompt-input UI shows the download only as a
    // "Loom video" attachment chip (icon + label) and no longer inserts the URL as a
    // pill link inside the editor.
    const loomUploadResponse = page.waitForResponse(
      response => response.url().includes('/api/upload/loom') && response.request().method() === 'POST',
      { timeout: 60000 }
    );

    // Paste the Loom URL into the tiptap editor.
    // The tiptap editor processes paste via ProseMirror's handlePaste extension, which
    // requires a real browser paste (Ctrl+V). We write the URL to the clipboard first,
    // then trigger Ctrl+V so the app's Loom URL detection handler fires correctly.
    await page.evaluate(async (url) => {
      await navigator.clipboard.writeText(url);
    }, LOOM_URL);
    await textarea.click();
    await page.keyboard.press('Control+v');

    // While downloading, the app shows a "Loom video" attachment chip below the editor
    await expect(page.getByText('Loom video')).toBeVisible();

    // After the download completes the attachment chip exposes a "Remove attachment" button
    await expect(page.getByRole('button', { name: 'Remove attachment' })).toBeVisible({ timeout: 60000 });

    // Extract the dashboard-uploads URL from the Loom upload API response
    const response = await loomUploadResponse;
    expect(response.ok(), `Loom upload request failed with status ${response.status()}`).toBe(true);
    const body = await response.json();
    const uploadUrl = body?.data?.url;
    expect(uploadUrl).toBeTruthy();
    expect(uploadUrl).toMatch(UPLOAD_URL_REGEX);

    // Verify the URL actually serves a playable video (correct content-type header)
    const videoResponse = await page.request.head(uploadUrl!);
    expect(videoResponse.status()).toBe(200);
    const contentType = videoResponse.headers()['content-type'];
    expect(contentType).toMatch(/^video\//);
  });
});
