import { test, expect } from "./fixtures";
import { getProjectSlug, navigateToSettings } from "./pages/settings";
import { isPreviewEnvironment } from "./pages/urls";

test.describe("Integrations Page", () => {
  test("verify install buttons redirect to correct URLs", async ({ page }) => {
    const projectSlug = getProjectSlug();

    // GitHub and Slack integrations are now on the Reporters settings page
    await navigateToSettings(page, "Reporters");

    // Verify GitHub and Slack integration options are present
    await expect(
      page.getByText("GitHub", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Slack", { exact: true }).first(),
    ).toBeVisible();

    // Test 1: GitHub action - both Install and Configure open the reporter app.
    // Installed projects also expose an internal delivery-status page.
    const githubCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("GitHub", { exact: true }) })
      .first();
    const githubAction = githubCard.getByRole("link", {
      name: /^(Install|Configure)$/,
    });
    await expect(githubAction).toBeVisible();
    const githubAppSlug = isPreviewEnvironment()
      ? "empirical-run-reporter-staging"
      : "empirical-run-reporter";
    await expect(githubAction).toHaveAttribute(
      "href",
      new RegExp(
        `^https://github\\.com/apps/${githubAppSlug}/installations/select_target\\?state=.+$`,
      ),
    );

    if ((await githubAction.textContent())?.trim() === "Configure") {
      await expect(
        githubCard.getByText("Installed", { exact: true }),
      ).toBeVisible();

      const deliveriesLink = githubCard.getByRole("link", {
        name: "View deliveries",
      });
      await expect(deliveriesLink).toHaveAttribute(
        "href",
        `/${projectSlug}/settings/reporters/github`,
      );
      await deliveriesLink.click();
      await expect(page).toHaveURL(
        new RegExp(`/${projectSlug}/settings/reporters/github$`),
      );
      await expect(
        page.getByRole("heading", { name: "GitHub deliveries" }),
      ).toBeVisible();
      const reportersLink = page.locator(
        `[data-slot="button"][href="/${projectSlug}/settings/reporters"]`,
      );
      await expect(reportersLink).toHaveText("Reporters");
      await reportersLink.click();
      await expect(page).toHaveURL(
        new RegExp(`/${projectSlug}/settings/reporters$`),
      );
    }

    // Test 2: Slack button
    // Slack has three states: Install (not connected), Installed (connected with
    // current scopes), and Fix Permissions (connected but missing current scopes).
    const slackButton = page
      .locator("div")
      .filter({ hasText: /^Slack/ })
      .getByRole("button")
      .first();
    await expect(slackButton).toBeVisible();
    await expect(slackButton).toHaveText(
      /^(Install|Installed|Fix Permissions)$/,
    );
    const slackState = (await slackButton.textContent())?.trim();

    if (slackState === "Installed") {
      // Installed is a disabled status indicator, not an OAuth action.
      await expect(slackButton).toBeDisabled();
    } else {
      // Install and Fix Permissions both start Slack OAuth (initial consent or
      // re-consent for newly required scopes).
      await expect(slackButton).toBeEnabled();
      await slackButton.click();
      await page.waitForURL(/slack\.com/);
      expect(page.url()).toContain("slack.com");
      await page.goBack();
      await expect(
        page.getByText("GitHub", { exact: true }).first(),
      ).toBeVisible();
    }

    // Jira and Linear integrations are now on the Requests settings page
    await navigateToSettings(page, "Requests");

    // Verify Jira and Linear integration options are present
    await expect(page.getByText("Jira", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Linear", { exact: true }).first(),
    ).toBeVisible();

    // Test 3: Jira connection - verify OAuth when disconnected, or the connected state
    const jiraSection = page.locator("div").filter({ hasText: /^Jira/ });
    const jiraButton = jiraSection.getByRole("button").first();
    await expect(jiraButton).toBeVisible();
    await expect(jiraButton).toHaveText(/^(Connect|Connected|Remove)$/);
    const jiraState = (await jiraButton.textContent())?.trim();

    if (jiraState === "Connect") {
      const [jiraPopup] = await Promise.all([
        page.waitForEvent("popup"),
        jiraButton.click(),
      ]);

      await jiraPopup.waitForLoadState();
      expect(jiraPopup.url()).toMatch(/atlassian\.net|atlassian\.com/);
      await jiraPopup.close();
    } else {
      // Remove is destructive, so only verify the existing connection.
      await expect(
        jiraSection.getByText("Connected", { exact: true }).first(),
      ).toBeVisible();
    }

    // Verify we're still on Requests page
    await expect(page.getByText("Jira", { exact: true }).first()).toBeVisible();

    // Test 4: Linear connection - verify OAuth when disconnected, or the connected state
    const linearSection = page.locator("div").filter({ hasText: /^Linear/ });
    const linearButton = linearSection.getByRole("button").first();
    await expect(linearButton).toBeVisible();
    await expect(linearButton).toHaveText(
      /^(Connect|Connected|Revoke(?: Linear)?)$/,
    );
    const linearState = (await linearButton.textContent())?.trim();

    if (linearState === "Connect") {
      const [linearPopup] = await Promise.all([
        page.waitForEvent("popup"),
        linearButton.click(),
      ]);

      await linearPopup.waitForLoadState();
      expect(linearPopup.url()).toContain("linear.app");
      await linearPopup.close();
    } else {
      // Revoke is destructive, so only verify the existing connection.
      await expect(
        linearSection.getByText("Connected", { exact: true }).first(),
      ).toBeVisible();
    }

    // Verify we're still on Requests page
    await expect(page.getByText("Jira", { exact: true }).first()).toBeVisible();
  });
});
