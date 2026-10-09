import { Page, expect, test } from "@playwright/test";
import { setTimeout as pollDelay } from "node:timers/promises";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl, getDashboardBaseUrl } from "./urls";
import { createBranchFromStaging, deleteBranch } from "./github";

const REPOSITORY = "empirical-run/lorem-ipsum-tests";

/**
 * A unique file path produces a unique Playwright ID, so snoozes from concurrent
 * runs (including old tests on main) cannot cover this attempt's failure.
 * Only the throwaway branch is changed; staging and its synced cases stay intact.
 */
export async function createSnoozeFixture(
  page: Page,
  branch: string,
): Promise<void> {
  await createBranchFromStaging(page, branch);
  const content = `import { test, expect } from "@playwright/test";

test("intentional snooze fixture failure", { tag: "@${branch}" }, async () => {
  // A genuine, deterministic Playwright assertion failure, not mocked run data.
  expect("unsnoozed fixture").toBe("snoozed fixture");
});
`;
  const response = await page.request.post(
    `${getDashboardBaseUrl()}/api/github/proxy`,
    {
      data: {
        method: "PUT",
        url: `/repos/${REPOSITORY}/contents/tests/${branch}.spec.ts`,
        body: {
          branch,
          message: "Add isolated failing snooze E2E fixture",
          content: Buffer.from(content).toString("base64"),
        },
      },
    },
  );
  await expect(response).toBeOK();
}

/** Execute only this attempt's tagged case on its explicit test-repository branch. */
export async function triggerSnoozeFixtureRun(
  page: Page,
  branch: string,
  environment: "env-to-test-snoozes" | "staging",
): Promise<number> {
  const response = await page.request.put(`${getApiBaseUrl()}/api/test-runs`, {
    headers: await getApiWorkerAuthHeaders(page),
    data: {
      project_id: Number(process.env.LOREM_IPSUM_PROJECT_ID),
      environment,
      branch,
      tags: [`@${branch}`],
      // The case key is isolated; do not enter the shared legacy environment
      // queue, where a peer's newer waiting run can replace this fixture run.
      concurrency: null,
    },
    timeout: 60000,
  });
  await expect(response).toBeOK();
  const run = (await response.json()).data.test_run;
  expect(run.state).not.toBe("error");
  expect(run.test_code.resolved.branch).toBe(branch);
  expect(run.test_code.resolved.fallback_reason).toBeNull();
  test.info().annotations.push({
    type: "Test Run URL",
    description: `${getDashboardBaseUrl()}/lorem-ipsum/test-runs/${run.id}`,
  });
  return run.id;
}

/** Delete once, then allow at most 10 seconds for healthy ref reads to converge. */
export async function deleteSnoozeFixture(
  page: Page,
  branch: string,
): Promise<void> {
  await deleteBranch(page, branch);
  const exactRef = `refs/heads/${branch}`;
  const deadline = Date.now() + 10_000;

  // Only healthy "still present" reads may retry. Unlike expect.poll, this loop
  // never catches request, status, JSON parsing or schema assertion failures.
  while (Date.now() < deadline) {
    const response = await page.request.post(
      `${getDashboardBaseUrl()}/api/github/proxy`,
      {
        data: {
          method: "GET",
          url: `/repos/${REPOSITORY}/git/matching-refs/heads/${branch}`,
        },
        timeout: Math.max(1, Math.min(5_000, deadline - Date.now())),
      },
    );
    expect(response.status(), "Ref read must return healthy HTTP 200").toBe(
      200,
    );
    expect(response.headers()["content-type"], "Ref read must be JSON").toMatch(
      /\bapplication\/(?:[\w.+-]+\+)?json\b/i,
    );
    const refs = await response.json();
    expect(Array.isArray(refs), "Ref read must return a JSON ref array").toBe(
      true,
    );
    for (const ref of refs) {
      expect(ref, "Each ref must have a string name").toEqual(
        expect.objectContaining({ ref: expect.any(String) }),
      );
      expect(ref.ref, "Each ref must name a branch").toMatch(
        /^refs\/heads\/.+$/,
      );
    }
    if (!refs.some((ref: { ref: string }) => ref.ref === exactRef)) {
      return;
    }
    await pollDelay(Math.min(250, Math.max(0, deadline - Date.now())));
  }
  throw new Error(`Fixture branch ${branch} still exists after 10 seconds`);
}
