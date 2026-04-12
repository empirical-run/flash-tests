import { test, expect } from "./fixtures";
import { dragAndDropFile, pasteFile } from "./pages/upload";
import { navigateToSessions, openNewSessionDialog } from "./pages/sessions";

const FILE_PATH = "./assets/image-upload-test.png";
const FILE_NAME = "image-upload-test.png";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\//;
const SESSION_PROMPT = "what is the download speed?";

test.describe('Session file uploads', () => {
  test('upload file via drag and drop during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    await page.locator('button:has(svg.lucide-plus)').click();

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await dragAndDropFile(page, FILE_PATH, textarea);

    // Verify the upload URL is shown in the textarea as a pill link
    await expect(textarea).toContainText(UPLOAD_URL_REGEX);
    await expect(textarea).toContainText(FILE_NAME);

    // Add the prompt after the uploaded URL (append, don't replace)
    await textarea.click();
    await textarea.press('End'); // Move cursor to end
    await textarea.press('Enter'); // Add newline
    await textarea.type(SESSION_PROMPT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions\//);

    trackCurrentSession(page);

    // Verify the user message bubble with the upload URL loads after session is created
    await expect(page.locator('[data-message-id]').filter({ hasText: UPLOAD_URL_REGEX })).toBeVisible({ timeout: 30000 });

    // Verify session is created and ready for interaction
    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });
    
    // Verify the user message contains both the upload URL and the prompt
    await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: UPLOAD_URL_REGEX }).and(page.locator('[target="_blank"]'))).toBeVisible({ timeout: 15000 });
    
    // Verify the assistant uses fetchFile tool and responds with download speed
    await expect(page.getByText('Used fetchFile tool')).toBeVisible({ timeout: 120000 });
    await expect(page.getByText('8.80 Mbps').first()).toBeVisible({ timeout: 30000 });
  });

  test('upload file via paste during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessions(page);
    await page.locator('button:has(svg.lucide-plus)').click();

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await pasteFile(FILE_PATH, textarea);

    // Verify the upload URL is shown in the textarea as a pill link
    await expect(textarea).toContainText(UPLOAD_URL_REGEX);
    await expect(textarea).toContainText(FILE_NAME);

    // Add the prompt after the uploaded URL (append, don't replace)
    await textarea.click();
    await textarea.press('End'); // Move cursor to end
    await textarea.press('Enter'); // Add newline
    await textarea.type(SESSION_PROMPT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions\//);

    trackCurrentSession(page);

    // Verify the user message bubble with the upload URL loads after session is created
    await expect(page.locator('[data-message-id]').filter({ hasText: UPLOAD_URL_REGEX })).toBeVisible({ timeout: 30000 });

    // Verify session is created and ready for interaction
    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });
    
    // Verify the user message contains both the upload URL and the prompt
    await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: UPLOAD_URL_REGEX }).and(page.locator('[target="_blank"]'))).toBeVisible({ timeout: 15000 });
    
    // Verify the assistant uses fetchFile tool and responds with download speed
    await expect(page.getByText('Used fetchFile tool')).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('8.80 Mbps').first()).toBeVisible({ timeout: 30000 });
  });
});
