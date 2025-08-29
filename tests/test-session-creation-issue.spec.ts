import { test, expect } from '@playwright/test';

test('confirm session creation breaking change', async ({ page }) => {
  await page.goto('/');
  
  // Navigate to sessions page and click New
  await page.getByRole('button', { name: 'New' }).click();
  
  // Try to click Create without filling Initial Prompt field
  const createButton = page.getByRole('button', { name: 'Create' });
  
  // Check if Create button is disabled
  const isDisabled = await createButton.isDisabled();
  console.log('Create button disabled:', isDisabled);
  
  // Try to click it anyway to see the actual behavior
  try {
    await createButton.click({ timeout: 5000 });
    console.log('Create button click succeeded');
  } catch (error) {
    console.log('Create button click failed:', error.message);
  }
  
  // Check if we can see any validation messages or field highlighting
  const promptField = page.getByPlaceholder('Enter an initial prompt');
  const fieldClasses = await promptField.getAttribute('class');
  console.log('Prompt field classes:', fieldClasses);
});