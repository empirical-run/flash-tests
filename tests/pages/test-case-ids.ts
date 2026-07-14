import { Page, expect, test } from "@playwright/test";
import { getApiBaseUrl } from "./urls";
import { getApiWorkerAuthHeaders } from "./api-auth";

/**
 * Annotates the current test with a clickable "Test Run URL" pointing to the
 * Lorem Ipsum test run in the dashboard. Derives the dashboard origin from the
 * current page URL so it works across environments.
 *
 * @param page      The Playwright page object
 * @param testRunId The ID of the triggered test run
 */
export function annotateTestRunUrl(page: Page, testRunId: number): void {
  const origin = page.url().split("/").slice(0, 3).join("/");
  test.info().annotations.push({
    type: "Test Run URL",
    description: `${origin}/lorem-ipsum/test-runs/${testRunId}`,
  });
}

/**
 * Known-stable Lorem Ipsum test case names used as fixtures by the
 * "run only specific test cases by id" tests. These map to real tests in the
 * empirical-run/lorem-ipsum-tests repo; if they are renamed there,
 * `resolveTestCaseIds` throws a clear "not found" error pointing here.
 */
export const LOREM_TEST_CASE_NAMES = {
  login: "click login button and input dummy email",
  searchAuth: "search for auth shows only 1 card",
} as const;

export interface LoremTestCase {
  id: string;
  name: string;
  file_path: string;
  playwright_project: string;
}

/**
 * Lists the Lorem Ipsum project's test cases via the API worker.
 *
 * Uses the API worker (api.empirical.run) with the authenticated user's bearer
 * token plus an `x-project-id` header so the request is scoped to the Lorem
 * Ipsum project. Returns the active test cases as synced from the repo.
 *
 * @param page The Playwright page object (must be authenticated)
 * @returns The list of Lorem Ipsum test cases
 */
export async function listLoremTestCases(page: Page): Promise<LoremTestCase[]> {
  const headers = await getApiWorkerAuthHeaders(page);
  const response = await page.request.get(
    `${getApiBaseUrl()}/api/v2/test-cases?per_page=100`,
    { headers },
  );
  await expect(response).toBeOK();
  const body = await response.json();
  return body.data.test_cases as LoremTestCase[];
}

/**
 * Resolves the Playwright test ids for the given test case names.
 *
 * Throws when any name cannot be found so tests fail fast (e.g. if the Lorem
 * Ipsum repo's test names change) instead of silently selecting nothing.
 *
 * @param testCases The list of test cases returned by listLoremTestCases
 * @param names The exact test case names to resolve
 * @returns The ids in the same order as the requested names
 */
export function resolveTestCaseIds(testCases: LoremTestCase[], names: string[]): string[] {
  return names.map((name) => {
    const match = testCases.find((tc) => tc.name === name);
    if (!match) {
      throw new Error(`Test case "${name}" not found in Lorem Ipsum project`);
    }
    return match.id;
  });
}

/**
 * Triggers a new Lorem Ipsum test run via the API, restricting execution to the
 * given `test_case_ids`.
 *
 * Uses the dashboard endpoint with the authenticated session cookies (the same
 * pattern other test-run tests use). Runs against the staging build so the run
 * completes quickly.
 *
 * @param page The Playwright page object (must be authenticated)
 * @param testCaseIds The Playwright test ids to run
 * @param branch The build branch to associate with the run
 * @returns The new test run's numeric database id
 */
export async function triggerRunWithTestCaseIds(
  page: Page,
  testCaseIds: string[],
  branch: string,
): Promise<number> {
  const response = await page.request.put("/api/test-runs", {
    headers: { "Content-Type": "application/json" },
    data: {
      project_id: Number(process.env.LOREM_IPSUM_PROJECT_ID),
      environment: "staging",
      build: {
        url: "https://lorem-ipsum-app-env-staging-empirical.vercel.app/",
        commit: "a1b2c3d4e5f6",
        branch,
      },
      test_case_ids: testCaseIds,
    },
    timeout: 60000,
  });
  await expect(response).toBeOK();
  const body = await response.json();
  const testRunId = body.data.test_run.id;
  expect(testRunId).toBeTruthy();
  return testRunId;
}

export interface LoremTestRunDetail {
  id: number;
  run_id: number;
  state: string;
  total_count: number;
  test_case_ids: string[];
}

/**
 * Fetches a Lorem Ipsum test run's detail object.
 *
 * @param page The Playwright page object (must be authenticated)
 * @param testRunId The numeric database id of the test run
 * @returns The run's detail object (includes run_id, state, total_count, test_case_ids)
 */
export async function getRunDetail(page: Page, testRunId: number): Promise<LoremTestRunDetail> {
  const response = await page.request.get(
    `/api/test-runs/${testRunId}?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}`,
  );
  await expect(response).toBeOK();
  const body = await response.json();
  const detail = body.data?.test_run?.testRun;
  expect(detail, "run detail (data.test_run.testRun) missing in response").toBeTruthy();
  return detail as LoremTestRunDetail;
}

// Terminal states a run can settle into.
const TERMINAL_STATES = ["ended", "error", "cancelled"];

/**
 * Polls a Lorem Ipsum test run until it reaches any terminal state
 * (`ended`, `error`, or `cancelled`).
 *
 * @param page The Playwright page object (must be authenticated)
 * @param testRunId The numeric database id of the test run
 * @param timeout Maximum time to wait, in milliseconds (default 5 minutes)
 * @returns The run's detail object once it is terminal
 */
export async function waitForRunTerminal(
  page: Page,
  testRunId: number,
  timeout = 300000,
): Promise<LoremTestRunDetail> {
  await expect
    .poll(async () => (await getRunDetail(page, testRunId)).state, {
      timeout,
      intervals: [5000],
    })
    .toMatch(new RegExp(`^(${TERMINAL_STATES.join("|")})$`));
  return getRunDetail(page, testRunId);
}

/**
 * Polls a Lorem Ipsum test run until it reaches the terminal `ended` state and
 * asserts it did not settle into a non-`ended` terminal state (e.g. `error`).
 *
 * @param page The Playwright page object (must be authenticated)
 * @param testRunId The numeric database id of the test run
 * @param timeout Maximum time to wait, in milliseconds (default 5 minutes)
 * @returns The run's detail object once it has ended
 */
export async function waitForRunEnded(
  page: Page,
  testRunId: number,
  timeout = 300000,
): Promise<LoremTestRunDetail> {
  const detail = await waitForRunTerminal(page, testRunId, timeout);
  expect(detail.state).toBe("ended");
  return detail;
}

/**
 * Returns the Playwright test ids of every case that actually executed in a run.
 *
 * Reads the ledger-sourced per-test results from the API worker, which lists
 * every executed case regardless of status (passed/failed/skipped/flaky).
 *
 * @param page The Playwright page object (must be authenticated)
 * @param testRunId The numeric database id of the test run
 * @returns The sorted list of executed pw_test_ids
 */
export async function getExecutedTestCaseIds(page: Page, testRunId: number): Promise<string[]> {
  const headers = await getApiWorkerAuthHeaders(page);
  const response = await page.request.get(
    `${getApiBaseUrl()}/api/v2/test-runs/${testRunId}/cases?per_page=200`,
    { headers },
  );
  await expect(response).toBeOK();
  const body = await response.json();
  expect(Array.isArray(body.data)).toBe(true);
  return (body.data as Array<{ pw_test_id: string }>)
    .map((c) => c.pw_test_id)
    .sort();
}

/**
 * Reads the `test_case_ids` recorded for a run from its status endpoint.
 *
 * The status endpoint is keyed by the run's `run_id` (a large numeric token),
 * not its database id.
 *
 * @param page The Playwright page object (must be authenticated)
 * @param runId The run's `run_id` token (from the run detail object)
 * @returns The status payload's `test_case_ids`
 */
export async function getStatusTestCaseIds(page: Page, runId: number): Promise<string[]> {
  const response = await page.request.get(`/api/test-runs/${runId}/status`);
  await expect(response).toBeOK();
  const body = await response.json();
  return body.data.test_case_ids as string[];
}
