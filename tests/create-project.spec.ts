import { test, expect } from "./fixtures";
import {
  openNewProjectForm,
  selectExistingOrganization,
  createNewOrganization,
  fillProjectName,
  submitAndExpectProject,
  projectSwitcher,
} from "./pages/create-project";

test.describe("Create Project (new onboarding flow)", () => {
  test("creates a new project in an existing organization", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(projectSwitcher(page)).toBeVisible();

    // Enter the create-project flow from the project switcher.
    await openNewProjectForm(page);

    // Use an existing organization for the new project.
    await selectExistingOrganization(page, "Example");

    // A unique name per run avoids collisions with previously created projects.
    const projectName = `AutoTest Existing Org ${Date.now()}`;
    const slug = await fillProjectName(page, projectName);

    // The summary reflects the project + repo that will be created (no org, as
    // an existing org was picked).
    await expect(
      page.getByText(
        `This will create: project "${projectName}", repo "${slug}-tests"`,
      ),
    ).toBeVisible();

    // Submitting creates the project and lands on it in the switcher.
    await submitAndExpectProject(page, projectName);
  });

  test("creates a new project in a new organization", async ({ page }) => {
    await page.goto("/");
    await expect(projectSwitcher(page)).toBeVisible();

    // Enter the create-project flow from the project switcher.
    await openNewProjectForm(page);

    // Create a brand new organization. The email domain must match the
    // signed-in automation user's own domain (example.com), otherwise the
    // backend rejects automatic team joining.
    const suffix = Date.now();
    const orgName = `AutoOrg ${suffix}`;
    await createNewOrganization(page, orgName, "example.com");

    const projectName = `AutoTest New Org ${suffix}`;
    const slug = await fillProjectName(page, projectName);

    // The summary now also reflects the org that will be created.
    await expect(
      page.getByText(
        `This will create: org "${orgName}", project "${projectName}", repo "${slug}-tests"`,
      ),
    ).toBeVisible();

    // Submitting creates the org + project and lands on the project.
    await submitAndExpectProject(page, projectName);
  });
});
