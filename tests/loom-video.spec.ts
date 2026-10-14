import { test, expect } from "./fixtures";
import {
  navigateToSessions,
  openNewSessionDialog,
  getNewSessionPromptInput,
} from "./pages/sessions";
import { writeTextToClipboard } from "./pages/clipboard";
import { verifyUploadedFileAccess } from "./pages/upload";

const LOOM_URL = "https://www.loom.com/share/883f92af399642b1a073e88d4f2bfd07";
test.describe("Loom Video", () => {
  test("Able to download Loom videos", async ({ page }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const textarea = getNewSessionPromptInput(page);

    // The files API uses POST /api/files/loom with data.file.url; deployments
    // predating the migration use /api/upload/loom with data.url. Capture the
    // re-hosted file URL from either response to
    // read the uploaded URL — the new prompt-input UI shows the download only as a
    // "Loom video" attachment chip (icon + label) and no longer inserts the URL as a
    // pill link inside the editor.
    const loomUploadResponse = page.waitForResponse(
      (response) =>
        /\/api\/(?:files|upload)\/loom$/.test(
          new URL(response.url()).pathname,
        ) && response.request().method() === "POST",
      { timeout: 60000 },
    );

    // Paste the Loom URL into the tiptap editor.
    // The tiptap editor processes paste via ProseMirror's handlePaste extension, which
    // requires a real browser paste (Ctrl+V). We write the URL to the clipboard first,
    // then trigger Ctrl+V so the app's Loom URL detection handler fires correctly.
    await writeTextToClipboard(page, LOOM_URL);
    await textarea.click();
    await page.keyboard.press("Control+v");

    // While downloading, the app shows a "Loom video" attachment chip below the editor
    await expect(page.getByText("Loom video")).toBeVisible();

    // After the download completes the attachment chip exposes a "Remove attachment" button
    await expect(
      page.getByRole("button", { name: "Remove attachment" }),
    ).toBeVisible({ timeout: 60000 });

    // Extract the file URL without depending on its host or path.
    const response = await loomUploadResponse;
    expect(
      response.ok(),
      `Loom upload request failed with status ${response.status()}`,
    ).toBe(true);
    const body = await response.json();
    const uploadUrl = body?.data?.file?.url ?? body?.data?.url;
    expect(uploadUrl).toEqual(expect.any(String));
    expect(uploadUrl).toMatch(/\S+/);

    // Verify playback in the signed-in browser context rather than only checking
    // HEAD response headers. Auth-walled files may redirect and URLs may be relative.
    const videoPage = await page.context().newPage();
    await videoPage.goto(new URL(uploadUrl, page.url()).href);
    const video = videoPage.locator("video");
    await expect(video).toBeVisible();
    await expect
      .poll(
        () => video.evaluate((element: HTMLVideoElement) => element.readyState),
        { timeout: 30000 },
      )
      .toBeGreaterThanOrEqual(2);
    await videoPage.close();
    await verifyUploadedFileAccess(page, uploadUrl);
  });
});
