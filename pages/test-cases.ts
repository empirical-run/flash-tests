import { expect, Page, test } from "@playwright/test";
import {
  KvPreconditionFailedError,
  type KVClient,
  type KvEntry,
} from "@empiricalrun/playwright-utils";
import { getApiBaseUrl, getDashboardBaseUrl } from "./urls";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { listLoremTestCases, resolveTestCaseIds } from "./test-case-ids";

export function getTestCaseIdFromUrl(page: Page): string {
  const testCaseId = page.url().match(/\/test-cases\/([^?/#]+)/)?.[1];
  if (!testCaseId) {
    throw new Error(`Could not parse test case id from URL: ${page.url()}`);
  }
  return testCaseId;
}

export async function getTestCaseTags(
  page: Page,
  testCaseId: string,
): Promise<string[]> {
  const response = await page.request.get(
    `${getApiBaseUrl()}/api/v2/test-cases/${testCaseId}`,
    { headers: await getApiWorkerAuthHeaders(page) },
  );
  await expect(response).toBeOK();

  const body = await response.json();
  return body.data.test_case.tags ?? [];
}

export async function setTestCaseTagsViaApi(
  page: Page,
  testCaseId: string,
  tags: string[],
): Promise<void> {
  const response = await page.request.patch(
    `${getApiBaseUrl()}/api/v2/test-cases/${testCaseId}`,
    {
      headers: await getApiWorkerAuthHeaders(page),
      data: { tags },
    },
  );
  await expect(response).toBeOK();
  await expect
    .poll(async () => await getTestCaseTags(page, testCaseId))
    .toEqual(tags);
}

export async function openTestCaseTagsEditor(page: Page): Promise<void> {
  const tagsSection = page.getByRole("heading", { name: "Tags" }).locator("..");
  await tagsSection.locator(".cursor-pointer").first().click();
  await expect(page.getByPlaceholder("tag1, tag2, ...")).toBeVisible();
}

export async function saveTestCaseTags(
  page: Page,
  testCaseId: string,
  tags: string[],
): Promise<void> {
  await page.getByPlaceholder("tag1, tag2, ...").fill(tags.join(", "));

  const patchResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v2/test-cases/${testCaseId}`) &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save" }).click();

  const patchResponse = await patchResponsePromise;
  expect(patchResponse.ok()).toBeTruthy();
  const body = await patchResponse.json();
  expect(body.data.test_case.tags).toEqual(tags);
  await expect(page.getByPlaceholder("tag1, tag2, ...")).not.toBeVisible();
  await expect
    .poll(async () => await getTestCaseTags(page, testCaseId))
    .toEqual(tags);
}

export async function navigateToTestCases(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.getByText("Lorem Ipsum", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Test Cases", exact: true }).click();
  await expect(page).toHaveURL(/test-cases$/);
  await expect(page.getByRole("heading", { name: "Test Cases" })).toBeVisible();
}

export async function openTestCase(
  page: Page,
  testName: string,
): Promise<void> {
  await page.getByLabel("Search test cases").fill(testName);
  const testCaseLink = page
    .getByRole("link", { name: new RegExp(testName) })
    .first();
  await expect(testCaseLink).toBeVisible();
  await testCaseLink.click();
  await expect(page).toHaveURL(/test-cases\/.*$/);
}

/**
 * The Lorem Ipsum case only the dated-tag test edits (no other spec reads it).
 * Lorem Ipsum's cases are synced from its repo, so tests can't create their own
 * (POST /api/v2/test-cases is 405).
 */
const TAG_EDIT_TEST_CASE_NAME = "has title";

/**
 * A tag PATCH on any case commits that case's spec file to Lorem Ipsum's
 * staging branch, then re-syncs every case from the new commit. Concurrent
 * edits, even on different cases, queue on that branch (PATCH > 15s), and a
 * late sync of an older commit drops a just-saved tag. So the unit of ownership is
 * the whole project's tag store, not one case: one lease for every flash run
 * (preview and production share Lorem Ipsum's data).
 */
/** Lorem Ipsum's default branch, where tag edits are committed. */
const TAG_EDIT_REPO_BRANCH = "staging";
const TAG_EDIT_LEASE_KEY = "test-case-tag-lease:lorem-ipsum";
// Longer than a sync wait plus the test; it only frees a crashed attempt's lease.
const TAG_EDIT_LEASE_TTL_SECONDS = 600;
// Comfortably above the observed ~25s commit-to-sync lag.
const TAG_SYNC_QUIET_MS = 45_000;

export type LeasedTestCase = {
  id: string;
  name: string;
  leaseVersion: number;
};

/**
 * Exclusively lease Lorem Ipsum's tag store and return the dedicated test
 * case. Waits while another attempt holds the lease.
 */
export async function leaseTagEditTestCase(
  page: Page,
  kv: KVClient,
): Promise<LeasedTestCase> {
  const [id] = resolveTestCaseIds(await listLoremTestCases(page), [
    TAG_EDIT_TEST_CASE_NAME,
  ]);
  const owner = {
    run: process.env.TEST_RUN_GITHUB_ACTION_ID ?? `local-${process.ppid}`,
    environment: process.env.TEST_RUN_ENVIRONMENT,
    test: test.info().testId,
    retry: test.info().retry,
  };

  let lease: KvEntry | null = null;
  await expect(async () => {
    lease = await claimLease(kv, owner);
    expect(lease, "another attempt holds the tag-edit lease").not.toBeNull();
  }).toPass({ timeout: 8 * 60_000, intervals: [5_000] });

  await waitForTagSyncToSettle(page, id);

  test.info().annotations.push({
    type: "Tag-edit lease",
    description: `${TAG_EDIT_TEST_CASE_NAME} (${id})`,
  });
  return {
    id,
    name: TAG_EDIT_TEST_CASE_NAME,
    leaseVersion: lease!.version,
  };
}

/**
 * Each tag commit on staging is re-synced into every case ~25s later, and
 * syncs can land late or out of order, overwriting newer edits. Wait until the
 * case reflects the latest staging commit that changed spec files and that
 * commit (and HEAD) is old enough that no earlier sync is still pending, so
 * other writers' syncs can't erase this attempt's tag.
 *
 * Commits that don't touch tests/ (e.g. the ENVIRONMENTS.yaml PR merges from
 * tests/environments.spec.ts) are not re-synced until the next spec commit, so
 * the case may be synced to the spec commit or to any later staging commit.
 */
async function waitForTagSyncToSettle(
  page: Page,
  testCaseId: string,
): Promise<void> {
  await expect
    .poll(
      async () => {
        const latestSpecCommit = await getLatestSpecCommit(page);
        const recent = await listRepoBranchCommits(page, TAG_EDIT_REPO_BRANCH);
        const specIndex = recent.findIndex(
          (c) => c.sha === latestSpecCommit.sha,
        );
        expect(
          specIndex,
          `latest spec commit ${latestSpecCommit.sha} within recent ${TAG_EDIT_REPO_BRANCH} commits`,
        ).toBeGreaterThanOrEqual(0);
        const syncedShas = recent.slice(0, specIndex + 1).map((c) => c.sha);
        const head = recent[0];

        const response = await page.request.get(
          `${getApiBaseUrl()}/api/v2/test-cases/${testCaseId}`,
          { headers: await getApiWorkerAuthHeaders(page) },
        );
        await expect(response).toBeOK();
        const body = await response.json();
        const isQuiet = (c: RepoCommit) =>
          Date.now() - Date.parse(c.committedAt) >= TAG_SYNC_QUIET_MS;
        return (
          syncedShas.includes(body.data.test_case.last_seen_commit_sha) &&
          isQuiet(latestSpecCommit) &&
          isQuiet(head)
        );
      },
      {
        message: `test case synced to a quiet latest spec commit on ${TAG_EDIT_REPO_BRANCH}`,
        timeout: 3 * 60_000,
        intervals: [3_000],
      },
    )
    .toBe(true);
}

type RepoCommit = { sha: string; committedAt: string };

async function getLoremRepoCommits(
  page: Page,
  query: string,
): Promise<RepoCommit[]> {
  const response = await page.request.post(
    `${getDashboardBaseUrl()}/api/github/proxy`,
    {
      data: {
        method: "GET",
        url: `/repos/empirical-run/lorem-ipsum-tests/commits?${query}`,
      },
    },
  );
  await expect(response).toBeOK();
  const commits: { sha: string; commit: { committer: { date: string } } }[] =
    await response.json();
  return commits.map((c) => ({
    sha: c.sha,
    committedAt: c.commit.committer.date,
  }));
}

/** Newest first. */
function listRepoBranchCommits(
  page: Page,
  branch: string,
): Promise<RepoCommit[]> {
  return getLoremRepoCommits(page, `sha=${branch}&per_page=50`);
}

/** The newest staging commit that changed anything under tests/ (spec files). */
async function getLatestSpecCommit(page: Page): Promise<RepoCommit> {
  const [commit] = await getLoremRepoCommits(
    page,
    `sha=${TAG_EDIT_REPO_BRANCH}&path=tests&per_page=1`,
  );
  expect(commit, "a staging commit touching tests/").toBeDefined();
  return commit;
}

async function claimLease(
  kv: KVClient,
  owner: Record<string, unknown>,
): Promise<KvEntry | null> {
  try {
    return await kv.set(TAG_EDIT_LEASE_KEY, owner, TAG_EDIT_LEASE_TTL_SECONDS, {
      ifAbsent: true,
    });
  } catch (error) {
    // Another attempt holds the lease.
    if (error instanceof KvPreconditionFailedError) return null;
    throw error;
  }
}

/** Release only this attempt's lease, at the version it wrote. */
export async function releaseTagEditTestCase(
  kv: KVClient,
  leased: LeasedTestCase,
): Promise<void> {
  expect(
    await kv.delete(TAG_EDIT_LEASE_KEY, { ifVersion: leased.leaseVersion }),
  ).toBe(true);
}
