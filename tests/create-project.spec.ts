import { test, expect } from "./fixtures";
import { isPreviewEnvironment } from "./pages/urls";
import {
  openNewProjectForm,
  selectExistingOrganization,
  createNewOrganization,
  fillProjectName,
  submitAndExpectProject,
  projectSwitcher,
} from "./pages/create-project";

test.describe("Create Project (new onboarding flow)", () => {
  // These tests provision real projects (and GitHub repos / orgs) that are not
  // cleaned up yet, so keep them off production until a cleanup step exists.
  test.skip(
    () => !isPreviewEnvironment(),
    "Creates real projects/repos; runs on preview only until cleanup exists",
  );

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
    // signed-in automation user's own domain, otherwise the backend rejects
    // automatic team joining. Derive it from the account the setup logs in as
    // rather than hardcoding, so it tracks the environment's automation user.
    const emailDomain = process.env.AUTOMATED_USER_EMAIL!.split("@")[1];
    const suffix = Date.now();
    const orgName = `AutoOrg ${suffix}`;
    await createNewOrganization(page, orgName, emailDomain);

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

    // A new organization has no billing plan. Its banner should provide a
    // working route to this project's Billing settings, without setting up billing.
    const noPlanBanner = page.getByRole("status").filter({
      hasText:
        "Your organisation is not on a billing plan. Reach out to the Empirical team to get set up.",
    });
    await expect(noPlanBanner).toBeVisible();
    const viewPlanLink = noPlanBanner.getByRole("link", {
      name: "View plan",
      exact: true,
    });
    await expect(viewPlanLink).toHaveAttribute(
      "href",
      `/${slug}/settings/billing`,
    );
    await viewPlanLink.click();
    await expect(page).toHaveURL(new RegExp(`/${slug}/settings/billing$`));
    await expect(
      page.getByRole("heading", { name: "Billing", exact: true }),
    ).toBeVisible();
    // App PR #7891 offers Managed to eligible new orgs instead of the
    // reach-out placeholder. Check the offer without purchasing a subscription.
    const planCard = page.locator('[data-slot="card"]').filter({
      has: page.getByText("Plan", { exact: true }),
    });
    await expect(planCard.getByText("Managed", { exact: true })).toBeVisible();
    await expect(planCard.getByText("$350.00", { exact: true })).toBeVisible();
    await expect(planCard.getByText("/ month", { exact: true })).toBeVisible();
    await expect(
      planCard.getByRole("row", {
        name: "Meter Included each month Overage",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      planCard.getByRole("row", {
        name: "AI credits 20,000 credits 1¢ per credit",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      planCard.getByRole("row", {
        name: "Test minutes 20,000 minutes 0.5¢ per minute",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      planCard.getByRole("button", { name: "Subscribe", exact: true }),
    ).toBeEnabled();
    await expect(
      planCard.getByText("Upgrade to a paid plan", { exact: true }),
    ).toHaveCount(0);
  });
});
