import { test, expect } from "./fixtures";

test.describe("Environment Variables", () => {
  test("add and delete environment variable", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();

    // Add a new environment variable
    const envVarName = `TEST_VAR_${Date.now()}`;
    const envVarValue = `test_value_${Date.now()}`;
    
    // Click Add Variable button to open the modal
    await page.getByRole('button', { name: 'Add Variable' }).click();
    
    // Wait for the modal to appear
    await expect(page.getByText('Add Environment Variable')).toBeVisible();
    
    // Fill in the environment variable name
    await page.getByPlaceholder('e.g., DATABASE_URL').fill(envVarName);
    
    // Fill in the environment variable value  
    await page.getByPlaceholder('e.g., postgres://...').fill(envVarValue);
    
    // Save the environment variable by clicking the modal's Add Variable button
    await page.getByRole('dialog').getByRole('button', { name: 'Add Variable' }).click();
    
    // Verify the environment variable was added to the list
    await expect(page.getByText(envVarName)).toBeVisible();
    
    // Verify the environment variable value is initially masked (for security)
    const envVarRow = page.getByRole('row', { name: envVarName });
    await expect(envVarRow).toBeVisible();
    
    // Click the eye icon to reveal the value
    await envVarRow.getByRole('button').first().click();
    
    // Now verify the actual value is visible
    await expect(page.getByText(envVarValue)).toBeVisible();
    
    // Delete the environment variable by clicking the delete button in its row
    await page.getByRole('row').filter({ hasText: envVarName }).getByRole('button').last().click();
    
    // Wait for the confirmation dialog to appear
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
    
    // Confirm the deletion by clicking the confirmation button
    await page.getByRole('button', { name: 'Delete' }).click();
    
    // Wait for the confirmation dialog to disappear
    await expect(page.getByText('Are you sure you want to delete')).not.toBeVisible();
    
    // Verify the environment variable was deleted
    await expect(page.getByText(envVarName)).not.toBeVisible();
    await expect(page.getByText(envVarValue)).not.toBeVisible();
  });

  test("add environment-specific override", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Click on the edit icon for Production environment
    // Use a flexible locator that works regardless of the number of variables
    await page.getByRole('row').filter({ hasText: 'Production' }).filter({ hasText: 'production' }).getByRole('button').first().click();
    
    // Click on the "Edit" button in the Environment Variables section
    await page.getByRole('button', { name: 'Edit' }).click();
    
    // Create a unique environment-specific variable
    const envVarName = `PROD_VAR_${Date.now()}`;
    const envVarValue = `production_value_${Date.now()}`;
    
    // Get the current content of the textarea
    const textarea = page.locator('textarea').first();
    const currentContent = await textarea.inputValue();
    
    // Clean up old TEST_VAR entries from previous test runs to avoid exceeding limits
    const lines = currentContent.split('\n');
    const cleanedLines = lines.filter(line => !line.startsWith('TEST_VAR_') && !line.startsWith('PROD_VAR_'));
    const cleanedContent = cleanedLines.join('\n');
    
    // Add the new variable to the textarea
    await textarea.fill(`${cleanedContent}\n${envVarName}=${envVarValue}`);
    
    // Save the environment variable changes
    await page.getByRole('button', { name: 'Save' }).click();
    
    // Update the environment to persist changes
    await page.getByRole('button', { name: 'Update' }).click();
    
    // Wait for the modal to close
    await expect(page.getByText('Edit Environment')).not.toBeVisible();
    
    // Verify the variable was saved by reopening the edit mode
    await page.getByRole('row', { name: 'Production' }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Edit' }).click();
    
    const verifyTextarea = page.locator('textarea').first();
    const verifyContent = await verifyTextarea.inputValue();
    
    // Verify the variable exists in the textarea
    expect(verifyContent).toContain(`${envVarName}=${envVarValue}`);
    
    // Clean up: Remove the test variable
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('Edit Environment')).not.toBeVisible();
    
    // Reopen for cleanup
    await page.getByRole('row', { name: 'Production' }).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Edit' }).click();
    
    const textareaCleanup = page.locator('textarea').first();
    const contentWithTestVar = await textareaCleanup.inputValue();
    const finalContent = contentWithTestVar.replace(`\n${envVarName}=${envVarValue}`, '');
    await textareaCleanup.fill(finalContent);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Update' }).click();
  });
});