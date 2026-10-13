import { test, expect } from "./fixtures";
import {
  getEnvironmentsYaml,
  mergeEnvironmentsYamlChange,
  removeTestEnvEntries,
  getSchedulerHtml,
} from "./pages/environments";
import { getDashboardBaseUrl } from "./pages/urls";

test.describe("Environment with Cron Schedule", () => {
  test.skip(
    process.env.TEST_RUN_ENVIRONMENT !== "production",
    "Scheduler cron registration is production-only",
  );

  const testEnvSlug = "test-env-scheduler-cron";
  const cronSchedule = "0 10 * * *";

  test.afterEach(async ({ page }) => {
    const buildUrl = getDashboardBaseUrl();
    const { content } = await getEnvironmentsYaml(page, buildUrl);
    const cleanedContent = removeTestEnvEntries(content);
    if (cleanedContent !== content) {
      await mergeEnvironmentsYamlChange(
        page,
        buildUrl,
        cleanedContent,
        "chore: cleanup test environments",
      );
    }
  });

  test("add environment with cron schedule and verify in UI and scheduler", async ({
    page,
  }) => {
    const buildUrl = getDashboardBaseUrl();

    // Step 1: Get current ENVIRONMENTS.yaml content from staging
    const { content: originalContent } = await getEnvironmentsYaml(
      page,
      buildUrl,
    );
    const contentWithoutStaleTestEnv = removeTestEnvEntries(originalContent);

    // Step 2: Append a stable test environment entry with cron schedule.
    // Reusing the slug prevents repeated runs from creating many unique environments
    // if a previous cleanup did not complete.
    const newEnvEntry = [
      ``,
      `  - slug: ${testEnvSlug}`,
      `    name: ${testEnvSlug}`,
      `    scheduled_trigger: '${cronSchedule}'`,
      ``,
    ].join("\n");
    await mergeEnvironmentsYamlChange(
      page,
      buildUrl,
      contentWithoutStaleTestEnv.trimEnd() + "\n" + newEnvEntry,
      `test: add ${testEnvSlug} environment with cron schedule`,
    );

    // Step 3: Navigate directly to the Environments settings page
    await page.goto("/lorem-ipsum/settings/environments");

    // Step 4: Wait for the new environment row to appear in the table.
    // The webhook from the merged PR fires async, so the page may load
    // before the backend has processed the sync. We poll with page reloads.
    await expect
      .poll(
        async () => {
          await page.reload();
          // Wait for the table to fully load (at least one existing row visible)
          await expect(
            page.getByRole("row").filter({ hasText: "staging" }),
          ).toBeVisible();
          return await page
            .getByRole("row")
            .filter({ hasText: testEnvSlug })
            .count();
        },
        {
          intervals: [3000, 5000, 5000, 5000, 10000, 10000, 10000],
          timeout: 60000,
        },
      )
      .toBeGreaterThan(0);

    const environmentsTable = page.getByRole("table").filter({
      has: page.getByRole("columnheader", { name: "Schedule", exact: true }),
    });
    const envRow = environmentsTable.getByRole("row").filter({
      has: page.getByText(testEnvSlug, { exact: true }),
    });

    // Step 5: Resolve Schedule by its header, not a fixed column position.
    const scheduleColumnIndex = await environmentsTable
      .getByRole("columnheader", { name: "Schedule", exact: true })
      .evaluate((header) =>
        Array.from(header.parentElement!.children).indexOf(header),
      );
    const scheduledTriggerCell = envRow
      .getByRole("cell")
      .nth(scheduleColumnIndex);
    await expect(scheduledTriggerCell).toHaveText(cronSchedule);

    // Assert the cron is registered in the scheduler worker,
    // then remove the env and assert it is deregistered.
    await expect
      .poll(
        async () => {
          const schedulerHtml = await getSchedulerHtml(page);
          return (
            schedulerHtml.includes(testEnvSlug) &&
            schedulerHtml.includes(cronSchedule)
          );
        },
        {
          intervals: [3000, 5000, 5000, 10000, 10000, 10000],
          timeout: 60000,
        },
      )
      .toBe(true);

    // Remove env from YAML (afterEach is also a safety net)
    const { content: currentContent } = await getEnvironmentsYaml(
      page,
      buildUrl,
    );
    await mergeEnvironmentsYamlChange(
      page,
      buildUrl,
      removeTestEnvEntries(currentContent),
      `test: remove ${testEnvSlug} environment`,
    );

    // Assert the entry is deregistered from the scheduler
    await expect
      .poll(async () => (await getSchedulerHtml(page)).includes(testEnvSlug), {
        intervals: [3000, 5000, 5000, 10000, 10000, 10000],
        timeout: 60000,
      })
      .toBe(false);
  });
});
