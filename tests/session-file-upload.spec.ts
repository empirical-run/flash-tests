import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

import { dragAndDropFile, pasteFile } from "./pages/upload";

const FILE_PATH = "./assets/image-upload-test.png";
const FILE_NAME = "image-upload-test.png";
const UPLOAD_URL_REGEX = /https:\/\/dashboard-uploads\.empirical\.run\/image-uploads\//;
const SESSION_PROMPT = "what is the download speed?";

async function navigateToSessionCreation(page: Page) {
  await page.goto('/');
  await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Sessions', exact: true }).click();
  await expect(page).toHaveURL(/sessions$/, { timeout: 10000 });
  await page.getByRole('button', { name: 'New' }).click();
}

test.describe('Session file uploads', () => {
  test('upload file via drag and drop during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessionCreation(page);

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await dragAndDropFile(page, FILE_PATH, textarea);

    // Verify the upload URL is shown in the textarea with "Uploaded:" prefix
    await expect(textarea).toContainText(/Uploaded: https:\/\/dashboard-uploads\.empirical\.run\/image-uploads\//);
    await expect(textarea).toContainText(UPLOAD_URL_REGEX);
    await expect(textarea).toContainText(FILE_NAME);

    // Add the prompt after the uploaded URL (append, don't replace)
    await textarea.click();
    await textarea.press('End'); // Move cursor to end
    await textarea.press('Enter'); // Add newline
    await textarea.type(SESSION_PROMPT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });

    trackCurrentSession(page);

    // Verify session is created and ready for interaction
    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });
    
    // Verify the user message with the prompt appears
    await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible({ timeout: 15000 });
    
    // Verify the assistant responds (it should ask for clarification or provide a response)
    await expect(page.locator('[data-message-id]').filter({ hasText: /assistant|I'm not sure|provide more/i }).first()).toBeVisible({ timeout: 60000 });
  });

  test('upload file via paste during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessionCreation(page);

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await pasteFile(FILE_PATH, textarea);

    // Verify the upload URL is shown in the textarea with "Uploaded:" prefix
    await expect(textarea).toContainText(/Uploaded: https:\/\/dashboard-uploads\.empirical\.run\/image-uploads\//);
    await expect(textarea).toContainText(UPLOAD_URL_REGEX);
    await expect(textarea).toContainText(FILE_NAME);

    // Add the prompt after the uploaded URL (append, don't replace)
    await textarea.click();
    await textarea.press('End'); // Move cursor to end
    await textarea.press('Enter'); // Add newline
    await textarea.type(SESSION_PROMPT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });

    trackCurrentSession(page);

    // Verify session is created and ready for interaction
    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });
    
    // Verify the user message with the prompt appears
    await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible({ timeout: 15000 });
    
    // Verify the assistant responds (it should ask for clarification or provide a response)
    await expect(page.locator('[data-message-id]').filter({ hasText: /assistant|I'm not sure|provide more/i }).first()).toBeVisible({ timeout: 60000 });
  });
});
