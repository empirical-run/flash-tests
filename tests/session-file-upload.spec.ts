import { test, expect } from "./fixtures";
import { appendPromptAndCreateUploadedFileSession, dragAndDropFile, pasteFile } from "./pages/upload";
import { navigateToSessions, openNewSessionDialog } from "./pages/sessions";

const FILE_PATH = "./assets/image-upload-test.png";
const FILE_NAME = "image-upload-test.png";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\//;
const SESSION_PROMPT = "read this image and tell me the download speed";
const LOOK_AT_AGENT_TOOL_REGEX = /(?:Used look-at-agent tool|Look At Agent completed)/i;

test.describe('Session file uploads', () => {
  test('upload file via drag and drop during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await dragAndDropFile(page, FILE_PATH, textarea);

    // Verify the upload URL is shown in the textarea as a pill link
    await expect(textarea).toContainText(UPLOAD_URL_REGEX);
    await expect(textarea).toContainText(FILE_NAME);

    await appendPromptAndCreateUploadedFileSession(page, textarea, SESSION_PROMPT);

    trackCurrentSession(page);
    test.info().annotations.push({ type: 'Session URL', description: page.url() });

    // Verify the user message bubble with the upload URL loads after session is created
    await expect(page.locator('[data-message-id]').filter({ hasText: UPLOAD_URL_REGEX })).toBeVisible({ timeout: 30000 });

    // Verify session is created and ready for interaction
    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });
    
    // Verify the user message contains both the upload URL and the prompt
    await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: UPLOAD_URL_REGEX }).and(page.locator('[target="_blank"]'))).toBeVisible({ timeout: 15000 });
    
    // Verify the assistant uses the image-reading tool to process the uploaded file
    await expect(page.getByText(LOOK_AT_AGENT_TOOL_REGEX)).toBeVisible({ timeout: 120000 });

    // Verify the assistant reads the correct download speed from the image
    await expect(page.getByText('8.80 Mbps').first()).toBeVisible({ timeout: 30000 });
  });

  test('upload file via paste during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    await openNewSessionDialog(page);

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await pasteFile(FILE_PATH, textarea);

    // Verify the upload URL is shown in the textarea as a pill link
    await expect(textarea).toContainText(UPLOAD_URL_REGEX);
    await expect(textarea).toContainText(FILE_NAME);

    await appendPromptAndCreateUploadedFileSession(page, textarea, SESSION_PROMPT);

    trackCurrentSession(page);
    test.info().annotations.push({ type: 'Session URL', description: page.url() });

    // Verify the user message bubble with the upload URL loads after session is created
    await expect(page.locator('[data-message-id]').filter({ hasText: UPLOAD_URL_REGEX })).toBeVisible({ timeout: 30000 });

    // Verify session is created and ready for interaction
    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });
    
    // Verify the user message contains both the upload URL and the prompt
    await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: UPLOAD_URL_REGEX }).and(page.locator('[target="_blank"]'))).toBeVisible({ timeout: 15000 });
    
    // Verify the assistant uses the image-reading tool to process the uploaded file
    await expect(page.getByText(LOOK_AT_AGENT_TOOL_REGEX)).toBeVisible({ timeout: 120000 });

    // Verify the assistant reads the correct download speed from the image
    await expect(page.getByText('8.80 Mbps').first()).toBeVisible({ timeout: 30000 });
  });
});
