import { test, expect } from "../lib/fixtures";
import {
  dragAndDropFile,
  pasteFile,
  verifyUploadedSession,
} from "../pages/upload";
import {
  navigateToSessions,
  openNewSessionDialog,
  getNewSessionPromptInput,
} from "../pages/sessions";

const FILE_PATH = "./assets/image-upload-test.png";
const FILE_NAME = "image-upload-test.png";
const SESSION_PROMPT =
  "Use your subagents to read this image and tell me the download speed";
test.describe("Session file uploads", () => {
  test("upload file via drag and drop during session creation", async ({
    page,
    trackCurrentSession,
  }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const textarea = getNewSessionPromptInput(page);

    await dragAndDropFile(page, FILE_PATH, textarea);

    // The uploaded file now renders as an attachment preview chip (image thumbnail +
    // filename + a "Remove attachment" button) above the textarea, instead of the
    // upload URL being inserted as text inside the textarea.
    await expect(page.getByRole("img", { name: FILE_NAME })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove attachment" }),
    ).toBeVisible();

    // Type the prompt into the (now empty) textarea
    await textarea.click();
    await textarea.fill(SESSION_PROMPT);
    await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/sessions\//);

    trackCurrentSession(page);
    test
      .info()
      .annotations.push({ type: "Session URL", description: page.url() });

    await verifyUploadedSession(page, {
      fileName: FILE_NAME,
      prompt: SESSION_PROMPT,
      expectedAnswer: "8.80 Mbps",
    });
  });

  test("upload file via paste during session creation", async ({
    page,
    trackCurrentSession,
  }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const textarea = getNewSessionPromptInput(page);

    await pasteFile(FILE_PATH, textarea);

    // The uploaded file now renders as an attachment preview chip (image thumbnail +
    // filename + a "Remove attachment" button) above the textarea, instead of the
    // upload URL being inserted as text inside the textarea.
    await expect(page.getByRole("img", { name: FILE_NAME })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove attachment" }),
    ).toBeVisible();

    // Type the prompt into the (now empty) textarea
    await textarea.click();
    await textarea.fill(SESSION_PROMPT);
    await expect(page.getByRole("button", { name: "Create" })).toBeEnabled();

    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/sessions\//);

    trackCurrentSession(page);
    test
      .info()
      .annotations.push({ type: "Session URL", description: page.url() });

    await verifyUploadedSession(page, {
      fileName: FILE_NAME,
      prompt: SESSION_PROMPT,
      expectedAnswer: "8.80 Mbps",
    });
  });
});
