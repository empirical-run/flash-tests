import { Page, expect } from "@playwright/test";
import { getApiBaseUrl } from "./urls";
import { getApiWorkerAuthHeaders } from "./api-auth";

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
  return body.data.test_run.testRun as LoremTestRunDetail;
}

/**
 * Polls a Lorem Ipsum test run until it reaches the terminal `ended` state.
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
  await expect
    .poll(async () => (await getRunDetail(page, testRunId)).state, {
      timeout,
      intervals: [5000],
    })
    .toBe("ended");
  return getRunDetail(page, testRunId);
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
