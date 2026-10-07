import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { test, expect } from "./fixtures";
import {
  completeTestSubscriptionCheckout,
  expectPersistedManagedSubscription,
  endTestSubscriptionThroughUi,
} from "./pages/billing-checkout";
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

  test("creates a new project in a new organization", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    testInfo.annotations.push({
      type: "deferred",
      description:
        "Arjun approved deferring org/project/repo cleanup and portal verification. Real portal attempts hit Vercel Security Checkpoint HTTP 429/Code 29; no URL-only substitute assertion. Subscription cleanup is exercised through End plan; fixtures from failed attempts remain identified in billing attachments.",
    });
    await page.goto("/");
    await expect(projectSwitcher(page)).toBeVisible();

    // Enter the create-project flow from the project switcher.
    await openNewProjectForm(page);

    // Create a brand new organization. The email domain must match the
    // signed-in automation user's own domain, otherwise the backend rejects
    // automatic team joining. Derive it from the account the setup logs in as
    // rather than hardcoding, so it tracks the environment's automation user.
    const emailDomain = process.env.AUTOMATED_USER_EMAIL!.split("@")[1];
    const suffix = randomUUID();
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

    // A new organization has no billing plan. Enter Billing through its banner.
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
    // Preserve the Managed offer's price, allowances and overage coverage
    // before proceeding through real test-mode checkout for app PR #7892.
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
      planCard.getByRole("button", {
        name: "Continue to payment",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      planCard.getByText("Upgrade to a paid plan", { exact: true }),
    ).toHaveCount(0);

    const billingUrl = page.url();
    const fixturePath = testInfo.outputPath("billing-fixture.json");
    await writeFile(
      fixturePath,
      JSON.stringify(
        {
          orgName,
          projectName,
          slug,
          repository: `empirical-run/${slug}-tests`,
          billingUrl,
        },
        null,
        2,
      ),
    );
    await testInfo.attach("billing-fixture", {
      path: fixturePath,
      contentType: "application/json",
    });
    await test.step("Subscribe through real hosted test checkout with the 4242 card", async () => {
      await planCard
        .getByRole("button", { name: "Continue to payment", exact: true })
        .click();
      await completeTestSubscriptionCheckout(page);
    });
    await test.step("Verify automatic return and activated Managed subscription", async () => {
      // Do not navigate back ourselves: checkout must return to this exact app/project.
      await expect(page).toHaveURL(
        (url) =>
          url.origin === new URL(billingUrl).origin &&
          url.pathname === new URL(billingUrl).pathname &&
          url.searchParams.get("status") === "active" &&
          /^sub_/.test(url.searchParams.get("subscription_id") || "") &&
          /^pay_/.test(url.searchParams.get("payment_id") || ""),
        { timeout: 60_000 },
      );
      const returnedUrl = new URL(page.url());
      const resultPath = testInfo.outputPath("billing-checkout-result.json");
      await writeFile(
        resultPath,
        JSON.stringify(
          {
            slug,
            subscriptionId: returnedUrl.searchParams.get("subscription_id"),
            paymentId: returnedUrl.searchParams.get("payment_id"),
          },
          null,
          2,
        ),
      );
      await testInfo.attach("billing-checkout-result", {
        path: resultPath,
        contentType: "application/json",
      });
      await expect(
        page.getByRole("heading", { name: "Billing", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Manage billing", exact: true }),
      ).toBeEnabled({ timeout: 60_000 });
      await expect(noPlanBanner).toHaveCount(0);
      const { projectId, renewal } =
        await expectPersistedManagedSubscription(page);
      await expect(
        planCard.getByText("Managed", { exact: true }),
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
      await test.step("End this checkout's subscription through the app and verify persisted no-plan state", async () => {
        const result = await endTestSubscriptionThroughUi(
          page,
          returnedUrl.searchParams.get("subscription_id")!,
          projectId,
          renewal,
          testInfo,
        );
        await testInfo.attach("billing-end-result", {
          body: JSON.stringify({ slug, ...result }, null, 2),
          contentType: "application/json",
        });
        await expect(
          planCard.getByText("Managed", { exact: true }),
        ).toBeVisible();
        await expect(noPlanBanner).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath("ended-plan.png"),
          fullPage: true,
        });
      });
    });
    // Portal CONTENT verification is intentionally deferred, not weakened to a
    // URL-only check: real attempts received Vercel Security Checkpoint 429/29.
    // The subscription is ended above. Org/project/repo deletion remains
    // deferred with approval; attachments identify fixtures if a step fails.
  });
});
