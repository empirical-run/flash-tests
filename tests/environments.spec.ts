import { test, expect } from "./fixtures";
import {
  getEnvironmentsYaml,
  updateEnvironmentsYaml,
  removeTestEnvEntries,
  getSchedulerHtml
} from "./pages/environments";
import { getDashboardBaseUrl } from "./pages/urls";

test.describe("Environment with Cron Schedule", () => {
  test.skip(process.env.TEST_RUN_ENVIRONMENT === 'preview', 'Scheduler cron registration is production-only');

  const testEnvSlug = "test-env-scheduler-cron";
  const cronSchedule = '0 10 * * *';

  test.afterEach(async ({ page }) => {
    const buildUrl = getDashboardBaseUrl();
    const { content, sha } = await getEnvironmentsYaml(page, buildUrl);
    const cleanedContent = removeTestEnvEntries(content);
    if (cleanedContent !== content) {
      await updateEnvironmentsYaml(
        page,
        buildUrl,
        cleanedContent,
        sha,
        "chore: cleanup test environments"
      );
    }
  });

  test("add environment with cron schedule and verify in UI and scheduler", async ({ page }) => {
    const buildUrl = getDashboardBaseUrl();

    // Step 1: Get current ENVIRONMENTS.yaml content and SHA
    const { content: originalContent, sha } = await getEnvironmentsYaml(page, buildUrl);
    const contentWithoutStaleTestEnv = removeTestEnvEntries(originalContent);

    // Step 2: Append a stable test environment entry with cron schedule.
    // Reusing the slug prevents repeated runs from creating many unique environments
    // if a previous cleanup did not complete.
    const newEnvEntry = [
      ``,
      `  - slug: ${testEnvSlug}`,
      `    name: ${testEnvSlug}`,
      `    scheduled_trigger: '${cronSchedule}'`,
      ``
    ].join('\n');
    await updateEnvironmentsYaml(
      page,
      buildUrl,
      contentWithoutStaleTestEnv.trimEnd() + '\n' + newEnvEntry,
      sha,
      `test: add ${testEnvSlug} environment with cron schedule`
    );

    // Step 3: Navigate directly to the Environments settings page
    await page.goto("/lorem-ipsum/settings/environments");

    // Step 4: Wait for the new environment row to appear in the table.
    // The webhook from the GitHub commit fires async, so the page may load
    // before the backend has processed the sync. We poll with page reloads.
    await expect.poll(async () => {
      await page.reload();
      // Wait for the table to fully load (at least one existing row visible)
      await expect(page.getByRole('row').filter({ hasText: 'staging' })).toBeVisible();
      return await page.getByRole('row').filter({ hasText: testEnvSlug }).count();
    }, {
      intervals: [3000, 5000, 5000, 5000, 10000, 10000, 10000],
      timeout: 60000
    }).toBeGreaterThan(0);

    const envRow = page.getByRole('row').filter({ hasText: testEnvSlug });

    // Step 5: Assert the Scheduled Trigger cell shows the cron expression (not '--')
    // Columns: Name, Slug, Playwright Projects, Scheduled Trigger
    const scheduledTriggerCell = envRow.getByRole('cell').nth(3);
    await expect(scheduledTriggerCell).not.toHaveText('--');
    await expect(scheduledTriggerCell).toContainText('0');
    await expect(scheduledTriggerCell).toContainText('10');

    // Production-only: assert the cron is registered in the scheduler worker,
    // then remove the env and assert it is deregistered.
    if (process.env.TEST_RUN_ENVIRONMENT === 'production') {
      const schedulerHtmlBefore = await getSchedulerHtml(page);
      expect(schedulerHtmlBefore).toContain(testEnvSlug);
      expect(schedulerHtmlBefore).toContain(cronSchedule);

      // Remove env from YAML (afterEach is also a safety net)
      const { content: currentContent, sha: currentSha } = await getEnvironmentsYaml(page, buildUrl);
      await updateEnvironmentsYaml(
        page, buildUrl,
        removeTestEnvEntries(currentContent),
        currentSha,
        `test: remove ${testEnvSlug} environment`
      );

      // Assert the entry is deregistered from the scheduler
      await expect.poll(async () => (await getSchedulerHtml(page)).includes(testEnvSlug), {
        intervals: [3000, 5000, 5000, 10000, 10000, 10000],
        timeout: 60000
      }).toBe(false);
    }
  });
});
