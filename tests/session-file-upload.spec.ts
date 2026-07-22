import { test, expect } from "./fixtures";
import { dragAndDropFile, pasteFile } from "./pages/upload";
import { getChatMessageByText, navigateToSessions, openNewSessionDialog } from "./pages/sessions";
import type { Page } from "@playwright/test";

const FILE_PATH = "./assets/image-upload-test.png";
const FILE_NAME = "image-upload-test.png";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\//;
const SESSION_PROMPT = "read this image and tell me the download speed";
const LOOK_AT_AGENT_TOOL_REGEX = /(?:Used look-at-agent tool|Look At Agent completed)/i;

// Verifies the created session behaves correctly after uploading a file: the user
// message bubble renders the file as a native attachment, and the assistant reads it.
async function verifyUploadedSession(page: Page) {
  // Verify session is created and ready for interaction
  await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });

  // The uploaded file now renders as a native attachment inside the user message
  // bubble: the filename is shown as text and a "View" link points at the upload URL
  // (target=_blank). The upload URL is no longer inserted as plain text.
  const userMessage = getChatMessageByText(page, FILE_NAME);
  await expect(userMessage).toBeVisible({ timeout: 30000 });

  // Verify the user message contains the prompt and the attachment
  await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible({ timeout: 15000 });
  const viewLink = userMessage.getByRole('link', { name: 'View' });
  await expect(viewLink).toHaveAttribute('href', UPLOAD_URL_REGEX);
  await expect(viewLink).toHaveAttribute('target', '_blank');

  // Verify the assistant uses the image-reading tool to process the uploaded file
  await expect(page.getByText(LOOK_AT_AGENT_TOOL_REGEX)).toBeVisible({ timeout: 120000 });

  // Verify the assistant reads the correct download speed from the image
  await expect(page.getByText('8.80 Mbps').first()).toBeVisible({ timeout: 30000 });
}

test.describe('Session file uploads', () => {
  test('upload file via drag and drop during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await dragAndDropFile(page, FILE_PATH, textarea);

    // The uploaded file now renders as an attachment preview chip (image thumbnail +
    // filename + a "Remove attachment" button) above the textarea, instead of the
    // upload URL being inserted as text inside the textarea.
    await expect(page.getByRole('img', { name: FILE_NAME })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove attachment' })).toBeVisible();

    // Type the prompt into the (now empty) textarea
    await textarea.click();
    await textarea.fill(SESSION_PROMPT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions\//);

    trackCurrentSession(page);
    test.info().annotations.push({ type: 'Session URL', description: page.url() });

    await verifyUploadedSession(page);
  });

  test('upload file via paste during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await pasteFile(FILE_PATH, textarea);

    // The uploaded file now renders as an attachment preview chip (image thumbnail +
    // filename + a "Remove attachment" button) above the textarea, instead of the
    // upload URL being inserted as text inside the textarea.
    await expect(page.getByRole('img', { name: FILE_NAME })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove attachment' })).toBeVisible();

    // Type the prompt into the (now empty) textarea
    await textarea.click();
    await textarea.fill(SESSION_PROMPT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions\//);

    trackCurrentSession(page);
    test.info().annotations.push({ type: 'Session URL', description: page.url() });

    await verifyUploadedSession(page);
  });
});
