import { Page, expect } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";
import {
  listLoremTestCases,
  LOREM_TEST_CASE_NAMES,
  resolveTestCaseIds,
} from "./test-case-ids";

/** Select a real fixture case not covered by any active snooze in either comparison environment. */
export async function selectUnsnoozedFixtureCase(page: Page): Promise<string> {
  const headers = await getApiWorkerAuthHeaders(page);
  const environmentResponse = await page.request.get(
    `${getApiBaseUrl()}/api/environments/list?project_repo_name=lorem-ipsum-tests`,
    { headers },
  );
  await expect(environmentResponse).toBeOK();
  const environments = (await environmentResponse.json()).data.environments;
  const environmentIds = ["SnoozeEnv", "staging"].map((name) => {
    const environment = environments.find(
      (env: { name: string }) => env.name === name,
    );
    expect(environment, `Missing comparison environment ${name}`).toBeTruthy();
    return environment.id;
  });

  const snoozedIds: string[] = [];
  let totalPages = 1;
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const response = await page.request.get(
      `${getApiBaseUrl()}/api/snoozes?status=active&per_page=100&page=${pageNumber}`,
      { headers },
    );
    await expect(response).toBeOK();
    const body = await response.json();
    totalPages = body.pagination.total_pages;
    for (const snooze of body.data.snoozes) {
      if (
        snooze.scoped_to_environment_id == null ||
        environmentIds.includes(snooze.scoped_to_environment_id)
      ) {
        snoozedIds.push(...snooze.test_ids);
      }
    }
  }

  // Prefer auth over the naturally failing database case used by older branches.
  // The caller explicitly forces failure with a per-run BASE_URL override.
  const candidates = resolveTestCaseIds(await listLoremTestCases(page), [
    LOREM_TEST_CASE_NAMES.searchAuth,
    LOREM_TEST_CASE_NAMES.login,
    LOREM_TEST_CASE_NAMES.searchDatabase,
  ]);
  const id = candidates.find((candidate) => !snoozedIds.includes(candidate));
  expect(
    id,
    "Need a fixture case unsnoozed in both SnoozeEnv and staging; leave existing snoozes intact",
  ).toBeTruthy();
  return id!;
}
