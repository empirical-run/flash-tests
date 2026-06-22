import { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { getSchedulerHtml, syncSchedulerSchedules } from "./pages/environments";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLoremIpsumWorkflowIdsForCron(schedulerHtml: string, cronSchedule: string): Set<string> {
  const ids = new Set<string>();
  const rowRegex = /<tr>[\s\S]*?<\/tr>/g;
  const cronRegex = new RegExp(`>\\s*${escapeRegex(cronSchedule)}\\s*<`);

  for (const rowMatch of schedulerHtml.matchAll(rowRegex)) {
    const row = rowMatch[0];
    if (!row.includes("Agent workflow for Lorem Ipsum") || !cronRegex.test(row)) {
      continue;
    }

    const id = row.match(/agent-workflow-cron-\d+/)?.[0];
    if (id) {
      ids.add(id);
    }
  }

  return ids;
}

async function deleteWorkflowByPrompt(page: Page, workflowPrompt: string): Promise<void> {
  await page.goto("/lorem-ipsum/agent-workflows");

  const workflowRow = page.getByRole("row").filter({ hasText: workflowPrompt });
  if ((await workflowRow.count()) === 0) {
    return;
  }

  await workflowRow.first().locator("button").last().click();

  const deleteDialog = page.getByRole("dialog", { name: "Delete Workflow" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("Workflow deleted", { exact: true })).toBeVisible();
  await expect(workflowRow).toHaveCount(0);
}

test.describe("Agent Workflows", () => {
  test.skip(process.env.TEST_RUN_ENVIRONMENT !== "production", "Scheduler cron registration is production-only");

  let workflowPrompt: string | undefined;

  test.afterEach(async ({ page }) => {
    if (!workflowPrompt) {
      return;
    }

    await deleteWorkflowByPrompt(page, workflowPrompt);
    await syncSchedulerSchedules(page);
  });

  test("create workflow, verify scheduler registration, then delete it", async ({ page }) => {
    const timestamp = Date.now();
    const prompt = `E2E scheduler workflow ${timestamp}`;
    workflowPrompt = prompt;
    const cronSchedule = `${timestamp % 60} ${(Math.floor(timestamp / 60) % 24)} * * ${(Math.floor(timestamp / 1440) % 7)}`;

    const schedulerHtmlBeforeCreate = await getSchedulerHtml(page);
    const schedulerIdsBeforeCreate = getLoremIpsumWorkflowIdsForCron(schedulerHtmlBeforeCreate, cronSchedule);

    await page.goto("/lorem-ipsum/agent-workflows");
    await expect(page.getByRole("heading", { name: "Agent Workflows" })).toBeVisible();

    await page.getByRole("button", { name: "Create Workflow" }).click();

    const createDialog = page.getByRole("dialog", { name: "Create Agent Workflow" });
    await expect(createDialog).toBeVisible();
    await expect(createDialog.getByRole("button", { name: "Create" })).toBeDisabled();

    await createDialog.getByRole("textbox", { name: "Enter the prompt for the agent..." }).fill(prompt);
    await createDialog.getByRole("textbox", { name: "e.g. 0 9 * * 1-5" }).fill(cronSchedule);
    await expect(createDialog.getByRole("button", { name: "Create" })).toBeEnabled();
    await createDialog.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText("Workflow created", { exact: true })).toBeVisible();

    const workflowRow = page.getByRole("row").filter({ hasText: prompt });
    await expect(workflowRow).toBeVisible();
    await expect(workflowRow).toContainText(cronSchedule);

    let schedulerWorkflowId: string | null = null;
    await expect.poll(async () => {
      const schedulerHtml = await getSchedulerHtml(page);
      const schedulerIds = getLoremIpsumWorkflowIdsForCron(schedulerHtml, cronSchedule);
      schedulerWorkflowId = [...schedulerIds].find((id) => !schedulerIdsBeforeCreate.has(id)) ?? null;
      return schedulerWorkflowId;
    }, {
      intervals: [3000, 5000, 5000, 10000, 10000, 10000],
      timeout: 60000,
    }).not.toBeNull();

    await deleteWorkflowByPrompt(page, prompt);
    await syncSchedulerSchedules(page);

    await expect.poll(async () => {
      const schedulerHtml = await getSchedulerHtml(page);
      return schedulerHtml.includes(schedulerWorkflowId!);
    }, {
      intervals: [3000, 5000, 5000, 10000, 10000, 10000],
      timeout: 60000,
    }).toBe(false);

    workflowPrompt = undefined;
  });
});
