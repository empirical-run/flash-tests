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

    // Assert the success toast and the empty state
    await expect(page.getByText("Resource deleted")).toBeVisible();
    await expect(page.getByText("No resources yet")).toBeVisible();
  });

  test("add a URL resource and delete it", async ({ page }) => {
    await page.goto("/lorem-ipsum/resources");

    // Open "Add resource" dropdown and select "Add a URL"
    await page.getByRole("button", { name: "Add resource" }).first().click();
    await page.getByRole("menuitem", { name: "Add a URL" }).click();

    const dialog = page.getByRole("dialog", { name: "Add URL" });
    await expect(dialog).toBeVisible();

    // Fill in the URL and name
    await dialog.getByRole("textbox", { name: "URL" }).fill("https://example.com");
    await dialog.getByRole("textbox", { name: "Name" }).fill("Example Resource");

    // Submit the form
    await dialog.getByRole("button", { name: "Add" }).click();

    // Assert the URL resource appears in the table
    const resourceRow = page.getByRole("row", { name: /Example Resource/ });
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

    // Assert the success toast and the empty state
    await expect(page.getByText("Resource deleted")).toBeVisible();
    await expect(page.getByText("No resources yet")).toBeVisible();
  });
});
