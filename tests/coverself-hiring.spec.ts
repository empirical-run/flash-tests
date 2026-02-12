import { test, expect } from "@playwright/test";

test("apply for SDET role and fill application form", async ({ page }) => {
  // Go to coverself.com and navigate to hiring page
  await page.goto("https://www.coverself.com/");
  await page.getByRole("link", { name: "We are Hiring!" }).click();

  // Click on the SDET role
  await page.getByRole("link", { name: /SDET-II/ }).click();

  // Click Apply for this job button
  await page.getByRole("button", { name: "Apply for this job" }).click();

  // Verify we're on the application form
  await expect(page.getByRole("heading", { name: "Apply for this job" })).toBeVisible();

  // Fill in First Name
  await page.getByRole("textbox", { name: "First Name *" }).click();
  await page.getByRole("textbox", { name: "First Name *" }).fill("John");

  // Fill in Last Name
  await page.getByRole("textbox", { name: "Last Name *" }).click();
  await page.getByRole("textbox", { name: "Last Name *" }).fill("Doe");

  // Fill in Middle Name
  await page.getByRole("textbox", { name: "Middle Name" }).click();
  await page.getByRole("textbox", { name: "Middle Name" }).fill("A");

  // Select country code for Mobile Phone
  await page.getByRole("combobox", { name: "Select" }).locator("b").click();
  await page.getByRole("searchbox").click();
  await page.getByRole("searchbox").fill("India");
  await page.getByText("India (+91)").click();

  // TODO(agent on page): Fill the Mobile Phone textbox with "9876543210", fill Email with "john.doe@example.com", scroll down and select Experience as "5-10 Years"
});
