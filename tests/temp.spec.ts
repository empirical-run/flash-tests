import { test } from '@playwright/test';

test('should click button on page', async ({ page }) => {
  await page.goto('https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/');
  // TODO(agent on page): click on the button and do nothing else
});