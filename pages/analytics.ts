import { Locator, Page, Request, Response, expect } from "@playwright/test";
import {
  KvPreconditionFailedError,
  type KVClient,
  type KvEntry,
} from "@empiricalrun/playwright-utils";
import { openHistoryBoxDetails } from "./history-box";

/**
 * Navigates to the Analytics page from the home page.
 * Starts at '/', clicks the Analytics nav link, and waits for the analytics URL.
 *
 * Assumes the user is already logged in (auth state is set up).
 *
 * @param page The Playwright page object
 */
export async function navigateToAnalytics(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: "Analytics" }).click();
  await expect(page).toHaveURL(/analytics/);
}

/**
 * Searches the analytics test cases list by typing a query into the
 * "Search tests..." input and submitting with Enter.
 *
 * Supports both plain-text name searches (e.g. 'login') and filter expressions
 * (e.g. 'fail_rate:>50').
 *
 * Assumes the page is already on the Analytics page.
 *
 * @param page  The Playwright page object
 * @param query The search text or filter expression to submit
 */
export async function searchTests(page: Page, query: string): Promise<void> {
  const searchInput = page.getByPlaceholder("Search tests...");
  await searchInput.fill(query);
  await searchInput.press("Enter");
}

/**
 * Filters the Analytics page by a single environment.
 *
 * Opens the environment combobox (defaults to "All environments") and selects
 * the option matching `environmentName`. Waits for the filter to be applied,
 * which the app signals by rendering a "Clear" button.
 *
 * Assumes the page is already on the Analytics page.
 *
 * @param page            The Playwright page object
 * @param environmentName The environment option to select (e.g. 'production')
 */
export async function filterAnalyticsEnvironment(
  page: Page,
  environmentName: string,
): Promise<void> {
  await page
    .getByRole("combobox")
    .filter({ hasText: "All environments" })
    .click();
  await page.getByRole("option", { name: environmentName }).click();
  // The environment filter renders a "Clear" button once applied.
  await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();
}

export type HistoryEntry = {
  test_run_id: string;
  environment_id: string;
  status: "pass" | "fail" | "flaky" | "skip";
};

/** Observe actual UI requests, without replaying credentials or substituting API data for UI proof. */
export function observeAnalyticsHistory(page: Page) {
  const responses: Response[] = [];
  const completed = new Set<Request>();
  const onFinished = (request: Request) => completed.add(request);
  const onResponse = (response: Response) => {
    if (
      new URL(response.url()).pathname ===
        "/api/v2/analytics/test-case-history/batch" &&
      response.request().method() === "POST"
    ) {
      responses.push(response);
    }
  };
  page.on("response", onResponse);
  page.on("requestfinished", onFinished);
  return {
    stop() {
      page.off("response", onResponse);
      page.off("requestfinished", onFinished);
    },
    async read(
      testId: string,
      environmentId?: string,
      timeoutMs = 15000,
    ): Promise<HistoryEntry[]> {
      const deadline = Date.now() + timeoutMs;
      const matches = () =>
        responses.filter((response) => {
          const request = response.request().postDataJSON();
          return (
            request.test_case_ids?.includes(testId) &&
            String(request.environment_id ?? "") === (environmentId ?? "")
          );
        });
      await expect
        .poll(() => matches().length, {
          message: "Scoped Analytics history response must arrive",
          timeout: Math.max(1, deadline - Date.now()),
        })
        .toBeGreaterThan(0);
      const response = matches().pop()!;
      await expect
        .poll(() => completed.has(response.request()), {
          message: "History response must complete",
          timeout: Math.max(1, deadline - Date.now()),
        })
        .toBe(true);
      expect(response.status(), "History API must be healthy").toBe(200);
      const body = await response.json();
      const entries = body.data.history_by_test_case_id[testId];
      expect(Array.isArray(entries)).toBe(true);
      return entries;
    },
  };
}

/** The link also includes file/tags, so anchor identity in its exact test-name span. */
export function analyticsTestCaseRow(
  page: Page,
  testCaseName: string,
): Locator {
  return page.getByRole("row").filter({
    has: page
      .getByRole("link")
      .filter({ has: page.getByText(testCaseName, { exact: true }) }),
  });
}

export async function analyticsRowTestId(
  page: Page,
  testCaseName: string,
): Promise<string> {
  const row = analyticsTestCaseRow(page, testCaseName);
  await expect(row).toHaveCount(1);
  const link = row
    .getByRole("link")
    .filter({ has: page.getByText(testCaseName, { exact: true }) });
  await expect(link).toHaveAttribute("href", /\/test-cases\/[a-f0-9-]+$/);
  const pathname = new URL((await link.getAttribute("href"))!, page.url())
    .pathname;
  const testId = pathname.split("/test-cases/")[1];
  expect(testId).toMatch(/^[a-f0-9]{20}-[a-f0-9]{20}$/);
  return testId;
}

/** A completed nested run recorded for an asynchronous ingestion check. */
export type PendingIngestionCheck = {
  runId: number;
  completedAt: number;
  buildUrl?: string;
  /** Flash run that claimed this check; set only by the consumer. */
  claimedBy?: string;
};

/** Runs must be visible in Analytics this long after completing. */
export const ANALYTICS_INGESTION_BUDGET_MS = 10 * 60_000;

// Entries stay well within the Analytics page's 7-day history window.
const PENDING_INGESTION_CHECK_TTL_SECONDS = 3 * 24 * 3600;

/**
 * KV prefix for nested Lorem Ipsum runs whose Analytics ingestion a later
 * flash run verifies. Scoped by flash environment: preview and production
 * talk to different deployments and must never check each other's runs.
 */
export function pendingIngestionCheckPrefix(): string {
  const environment = process.env.TEST_RUN_ENVIRONMENT;
  expect(environment, "TEST_RUN_ENVIRONMENT must be set").toBeTruthy();
  return `async-checks:analytics-ingestion:${environment}:`;
}

/**
 * Identifies the current flash run across retries. Locally there is no run
 * id, but retries run in workers of the same Playwright runner process.
 */
function currentFlashRunKey(): string {
  return process.env.TEST_RUN_GITHUB_ACTION_ID ?? `local-${process.ppid}`;
}

/** Producer: record a completed nested run for a later Analytics check. */
export async function recordPendingIngestionCheck(
  kv: KVClient,
  runId: number,
): Promise<void> {
  await kv.set<PendingIngestionCheck>(
    `${pendingIngestionCheckPrefix()}${runId}`,
    { runId, completedAt: Date.now(), buildUrl: process.env.BUILD_URL },
    PENDING_INGESTION_CHECK_TTL_SECONDS,
    { ifAbsent: true },
  );
}

/**
 * Consumer: claim every recorded run that completed longer ago than the
 * ingestion budget, plus any this flash run already claimed on an earlier
 * attempt (so a retry re-checks them instead of finding nothing). Claims are
 * conditional writes, so concurrent flash runs never check the same run.
 * Fresher entries are left for a later run. Delete the claimed entries with
 * completePendingIngestionChecks once they pass; a check that keeps failing
 * stays claimed until its TTL, which emits kv.expired.
 */
export async function claimDuePendingIngestionChecks(
  kv: KVClient,
): Promise<KvEntry<PendingIngestionCheck>[]> {
  const runKey = currentFlashRunKey();
  const claimed: KvEntry<PendingIngestionCheck>[] = [];
  for await (const entry of kv.entries<PendingIngestionCheck>(
    pendingIngestionCheckPrefix(),
  )) {
    const { completedAt, claimedBy } = entry.value;
    if (claimedBy === runKey) {
      claimed.push(entry);
    } else if (
      !claimedBy &&
      Date.now() - completedAt >= ANALYTICS_INGESTION_BUDGET_MS
    ) {
      const claim = await claimEntry(kv, entry, runKey);
      if (claim) claimed.push(claim);
    }
  }
  return claimed;
}

async function claimEntry(
  kv: KVClient,
  entry: KvEntry<PendingIngestionCheck>,
  runKey: string,
): Promise<KvEntry<PendingIngestionCheck> | null> {
  // Keep the producer's expiry: claiming must not extend the entry's life.
  const remainingTtlSeconds = Math.max(
    60,
    Math.floor((Date.parse(entry.expires_at) - Date.now()) / 1000),
  );
  try {
    return await kv.set<PendingIngestionCheck>(
      entry.key,
      { ...entry.value, claimedBy: runKey },
      remainingTtlSeconds,
      { ifVersion: entry.version },
    );
  } catch (error) {
    // Another flash run claimed (or completed) it between list and write.
    if (error instanceof KvPreconditionFailedError) return null;
    throw error;
  }
}

/** Delete checks that passed, at their claimed version. */
export async function completePendingIngestionChecks(
  kv: KVClient,
  claimed: KvEntry<PendingIngestionCheck>[],
): Promise<void> {
  for (const entry of claimed) {
    expect(await kv.delete(entry.key, { ifVersion: entry.version })).toBe(true);
  }
}

/**
 * Every claimed run is past the ingestion budget, so the first scoped history
 * response must already contain it: no reload-to-pass. All missing runs are
 * reported together, then each present run must render as a Failed box.
 */
export async function expectRunsInTestCaseHistory(
  page: Page,
  options: {
    runIds: number[];
    testCaseName: string;
    history: ReturnType<typeof observeAnalyticsHistory>;
  },
): Promise<void> {
  const { runIds, testCaseName, history } = options;
  const testId = await analyticsRowTestId(page, testCaseName);
  const environmentId = new URL(page.url()).searchParams.get("environment");
  expect(
    environmentId,
    "History must be scoped to the selected environment",
  ).toBeTruthy();
  const entries = await history.read(testId, environmentId!);
  history.stop();
  const entriesByRunId = new Map(
    entries.map((entry) => [Number(entry.test_run_id), entry]),
  );

  const missingRunIds = runIds.filter((runId) => !entriesByRunId.has(runId));
  expect(
    missingRunIds,
    `Runs missing from the "${testCaseName}" Analytics history more than ${ANALYTICS_INGESTION_BUDGET_MS / 60_000} minutes after completing`,
  ).toEqual([]);

  const row = analyticsTestCaseRow(page, testCaseName);
  const runBox = (runId: number) =>
    row.getByRole("button", { name: `Run #${runId}: Failed`, exact: true });
  for (const runId of runIds) {
    expect.soft(entriesByRunId.get(runId)).toMatchObject({
      environment_id: environmentId,
      status: "fail",
    });
    await expect.soft(runBox(runId)).toBeVisible();
  }

  // The popover proof is per-row UI behaviour; one claimed run covers it.
  await openHistoryBoxDetails(page, runBox(runIds[0]), {
    runId: runIds[0],
    testId,
    status: "Failed",
  });
}
