import { test, expect } from "./fixtures";

test.describe("Resources", () => {
  test("upload a file and delete it", async ({ page }) => {
    await page.goto("/lorem-ipsum/resources");

    // Open "Add resource" dropdown and select "Upload a file"
    await page.getByRole("button", { name: "Add resource" }).first().click();
    await page.getByRole("menuitem", { name: "Upload a file" }).click();

    // Upload a text file via the hidden file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test-resource.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Hello from Playwright test"),
    });

    // Sort by Modified descending (newest first) so the newly uploaded file is visible on page 1
    await page.getByRole("columnheader", { name: "Modified" }).click();
    await page.getByRole("columnheader", { name: "Modified" }).click();

    // Assert the uploaded file appears in the resources table
    const fileRow = page.getByRole("row", { name: /test-resource\.txt/ });
    await expect(fileRow).toBeVisible();
    await expect(fileRow).toContainText("plain");

    // Delete the resource via the row action menu
    await fileRow.getByRole("button").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    // Confirm deletion in the alert dialog
    await expect(
      page.getByRole("alertdialog", { name: "Delete Resource" })
    ).toBeVisible();
    await page
      .getByRole("alertdialog", { name: "Delete Resource" })
      .getByRole("button", { name: "Delete" })
      .click();

    // Assert the success toast and that the file row is gone
    await expect(page.getByText("Resource deleted", { exact: true })).toBeVisible();
    await expect(fileRow).not.toBeVisible();
  });

  test("add a URL resource and delete it", async ({ page }) => {
    await page.goto("/lorem-ipsum/resources");

    // Open "Add resource" dropdown and select "Add a URL"
    await page.getByRole("button", { name: "Add resource" }).first().click();
    await page.getByRole("menuitem", { name: "Add a URL" }).click();

    const dialog = page.getByRole("dialog", { name: "Add URL" });
    await expect(dialog).toBeVisible();

    // Use a unique name to avoid strict mode violations from leftover resources
    const resourceName = `PW URL Resource ${Date.now()}`;

    // Fill in the URL and name
    await dialog.getByRole("textbox", { name: "URL" }).fill("https://example.com");
    await dialog.getByRole("textbox", { name: "Name" }).fill(resourceName);

    // Submit the form
    await dialog.getByRole("button", { name: "Add" }).click();

    // Sort by Modified descending (newest first) so the newly added resource is visible on page 1
    await page.getByRole("columnheader", { name: "Modified" }).click();
    await page.getByRole("columnheader", { name: "Modified" }).click();

    // Assert the URL resource appears in the table
    const resourceRow = page.getByRole("row", { name: new RegExp(resourceName) });
    await expect(resourceRow).toBeVisible();

    // Delete the resource via the row action menu
    await resourceRow.getByRole("button").click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    // Confirm deletion
    await expect(
      page.getByRole("alertdialog", { name: "Delete Resource" })
    ).toBeVisible();
    await page
      .getByRole("alertdialog", { name: "Delete Resource" })
      .getByRole("button", { name: "Delete" })
      .click();

    // Assert the success toast and that the resource row is gone
    await expect(page.getByText("Resource deleted", { exact: true })).toBeVisible();
    await expect(resourceRow).not.toBeVisible();
  });
});
