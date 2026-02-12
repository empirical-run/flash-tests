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

  // TODO(agent on page): Fill in the First Name field with "John", Last Name with "Doe", Middle Name with "A", select country code for Mobile Phone and enter "9876543210", fill Email with "john.doe@example.com", and select Experience as "5-10 Years"
});
