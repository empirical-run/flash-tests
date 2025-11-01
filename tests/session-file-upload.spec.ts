import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

import { dragAndDropFile, pasteFile } from "./pages/upload";

const FILE_PATH = "./assets/image-upload-test.png";
const FILE_NAME = "image-upload-test.png";
const UPLOAD_CHIP_TEXT = `1 file uploaded: ${FILE_NAME}`;
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

    await expect(page.getByText(UPLOAD_CHIP_TEXT)).toBeVisible({ timeout: 15000 });
    await expect(textarea).toContainText(UPLOAD_URL_REGEX);
    await expect(textarea).toContainText(FILE_NAME);

    await textarea.fill(SESSION_PROMPT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });

    trackCurrentSession(page);

    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('link', { name: UPLOAD_URL_REGEX })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible();
    await expect(page.getByText('Used fetchFile tool')).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('8.80 Mbps').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByLabel('Details')).toContainText(FILE_NAME);
  });

  test('upload file via paste during session creation', async ({ page, trackCurrentSession }) => {
    await navigateToSessionCreation(page);

    const textarea = page.getByPlaceholder('Enter an initial prompt or drag and drop a file here');

    await pasteFile(FILE_PATH, textarea);

    await expect(page.getByText(UPLOAD_CHIP_TEXT)).toBeVisible({ timeout: 15000 });
    await expect(textarea).toContainText(UPLOAD_URL_REGEX);
    await expect(textarea).toContainText(FILE_NAME);

    await textarea.fill(SESSION_PROMPT);
    await expect(page.getByRole('button', { name: 'Create' })).toBeEnabled();

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/sessions\//, { timeout: 10000 });

    trackCurrentSession(page);

    await expect(page.getByPlaceholder('Type your message here...')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('link', { name: UPLOAD_URL_REGEX })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(SESSION_PROMPT).first()).toBeVisible();
    await expect(page.getByText('Used fetchFile tool')).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('8.80 Mbps').first()).toBeVisible({ timeout: 30000 });
  });
});
