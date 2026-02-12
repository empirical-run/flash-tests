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
  await page.getByRole("textbox", { name: "First Name *" }).fill("John");

  // Fill in Last Name
  await page.getByRole("textbox", { name: "Last Name *" }).fill("Doe");

  // Fill in Middle Name
  await page.getByRole("textbox", { name: "Middle Name" }).fill("A");

  // Select country code for Mobile Phone
  await page.getByRole("combobox", { name: "Select" }).locator("b").click();
  await page.getByRole("searchbox").fill("India");
  await page.getByText("India (+91)").click();

  // Fill in Mobile Phone number
  await page.getByRole("textbox", { name: "Mobile Phone" }).fill("9876543210");

  // Fill in Email
  await page.getByRole("textbox", { name: "Email *" }).fill("john.doe@example.com");

  // Fill in Experience (Years)
  await page.getByRole("textbox", { name: "Experience *" }).fill("5");

  // Verify that the form is filled in correctly (without submitting)
  await expect(page.getByRole("textbox", { name: "First Name *" })).toHaveValue("John");
  await expect(page.getByRole("textbox", { name: "Last Name *" })).toHaveValue("Doe");
  await expect(page.getByRole("textbox", { name: "Email *" })).toHaveValue("john.doe@example.com");
});
