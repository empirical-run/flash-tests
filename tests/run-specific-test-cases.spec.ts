import { test, expect } from "./fixtures";
import { generateUniqueBranchName } from "./pages/branch-name";
import { deleteBranch } from "./pages/github";
import {
  listLoremTestCases,
  resolveTestCaseIds,
  triggerRunWithTestCaseIds,
  waitForRunEnded,
  getExecutedTestCaseIds,
  getStatusTestCaseIds,
} from "./pages/test-case-ids";

// Each test triggers a real Lorem Ipsum test run and waits for it to complete,
// so give them a generous timeout.
test.describe("Run only specific test cases by id", () => {
  test.describe.configure({ timeout: 360000 });

  test("triggering with two test_case_ids runs ONLY those two tests", async ({ page }) => {
    await page.goto("/");

    // Pick a specific subset of two test cases from two different spec files so
    // the filter has to exclude the project's other test cases.
    const testCases = await listLoremTestCases(page);
    expect(testCases.length).toBeGreaterThan(2);
    const selectedIds = resolveTestCaseIds(testCases, [
      "click login button and input dummy email",
      "search for auth shows only 1 card",
    ]);
    const expectedIds = [...selectedIds].sort();

    // Trigger a run restricted to exactly those two ids.
    const branch = generateUniqueBranchName("run-two-test-case-ids");
    const testRunId = await triggerRunWithTestCaseIds(page, selectedIds, branch);
    test.info().annotations.push({
      type: "Test Run URL",
      description: `${page.url().split("/").slice(0, 3).join("/")}/lorem-ipsum/test-runs/${testRunId}`,
    });

    // Poll until the run reaches the terminal `ended` state.
    const runDetail = await waitForRunEnded(page, testRunId);

    // The run executed ONLY the two selected test cases.
    expect(runDetail.total_count).toBe(2);
    const executedIds = await getExecutedTestCaseIds(page, testRunId);
    expect(executedIds).toEqual(expectedIds);

    // The status endpoint reports back exactly the ids that were submitted.
    const statusIds = await getStatusTestCaseIds(page, runDetail.run_id);
    expect([...statusIds].sort()).toEqual(expectedIds);

    await deleteBranch(page, branch);
  });

  test("triggering with a single test_case_id runs exactly one test", async ({ page }) => {
    await page.goto("/");

    const testCases = await listLoremTestCases(page);
    const selectedIds = resolveTestCaseIds(testCases, [
      "click login button and input dummy email",
    ]);
    const expectedIds = [...selectedIds].sort();

    const branch = generateUniqueBranchName("run-one-test-case-id");
    const testRunId = await triggerRunWithTestCaseIds(page, selectedIds, branch);
    test.info().annotations.push({
      type: "Test Run URL",
      description: `${page.url().split("/").slice(0, 3).join("/")}/lorem-ipsum/test-runs/${testRunId}`,
    });

    const runDetail = await waitForRunEnded(page, testRunId);

    expect(runDetail.total_count).toBe(1);
    const executedIds = await getExecutedTestCaseIds(page, testRunId);
    expect(executedIds).toEqual(expectedIds);

    const statusIds = await getStatusTestCaseIds(page, runDetail.run_id);
    expect([...statusIds].sort()).toEqual(expectedIds);

    await deleteBranch(page, branch);
  });

  test("a non-existent test_case_id is ignored and only the valid test runs", async ({ page }) => {
    await page.goto("/");

    const testCases = await listLoremTestCases(page);
    const [validId] = resolveTestCaseIds(testCases, [
      "search for auth shows only 1 card",
    ]);
    // A syntactically-valid-looking id that does not match any test case.
    const nonExistentId = "0000000000000000dead-0000000000000000beef";
    const submittedIds = [validId, nonExistentId];

    const branch = generateUniqueBranchName("run-unknown-test-case-id");
    const testRunId = await triggerRunWithTestCaseIds(page, submittedIds, branch);
    test.info().annotations.push({
      type: "Test Run URL",
      description: `${page.url().split("/").slice(0, 3).join("/")}/lorem-ipsum/test-runs/${testRunId}`,
    });

    // The run still succeeds (reaches a terminal state) despite the unknown id.
    const runDetail = await waitForRunEnded(page, testRunId);

    // Only the valid test ran; the unknown id was silently ignored.
    expect(runDetail.total_count).toBe(1);
    const executedIds = await getExecutedTestCaseIds(page, testRunId);
    expect(executedIds).toEqual([validId]);

    // The status endpoint echoes back the originally-submitted ids (including the
    // unknown one) since it reflects the trigger request payload.
    const statusIds = await getStatusTestCaseIds(page, runDetail.run_id);
    expect([...statusIds].sort()).toEqual([...submittedIds].sort());

    await deleteBranch(page, branch);
  });
});
