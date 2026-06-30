import { test, expect } from "./fixtures";
import { generateUniqueBranchName } from "./pages/branch-name";
import { deleteBranch } from "./pages/github";
import {
  LOREM_TEST_CASE_NAMES,
  listLoremTestCases,
  resolveTestCaseIds,
  triggerRunWithTestCaseIds,
  waitForRunEnded,
  waitForRunTerminal,
  getExecutedTestCaseIds,
  getStatusTestCaseIds,
} from "./pages/test-case-ids";

// Each test triggers a real Lorem Ipsum test run and waits for it to complete,
// so give them a generous timeout.
test.describe("Run only specific test cases by id", () => {
  test.describe.configure({ timeout: 360000 });

  // Track build branches created by triggered runs so they are cleaned up even
  // when a test fails before reaching its inline cleanup (e.g. a poll timeout).
  let branchesToCleanup: string[] = [];

  test.afterEach(async ({ page }) => {
    for (const branch of branchesToCleanup) {
      await deleteBranch(page, branch);
    }
    branchesToCleanup = [];
  });

  test("triggering with a single test_case_id runs ONLY that test", async ({ page }) => {
    await page.goto("/");

    // Pick a specific single test case so the filter has to exclude the
    // project's other test cases.
    const testCases = await listLoremTestCases(page);
    expect(testCases.length).toBeGreaterThan(1);
    const selectedIds = resolveTestCaseIds(testCases, [
      LOREM_TEST_CASE_NAMES.login,
    ]);

    // Trigger a run restricted to exactly that id.
    const branch = generateUniqueBranchName("run-one-test-case-id");
    branchesToCleanup.push(branch);
    const testRunId = await triggerRunWithTestCaseIds(page, selectedIds, branch);
    test.info().annotations.push({
      type: "Test Run URL",
      description: `${page.url().split("/").slice(0, 3).join("/")}/lorem-ipsum/test-runs/${testRunId}`,
    });

    // Poll until the run reaches the terminal `ended` state.
    const runDetail = await waitForRunEnded(page, testRunId);

    // The run executed ONLY the selected test case.
    expect(runDetail.total_count).toBe(1);
    const executedIds = await getExecutedTestCaseIds(page, testRunId);
    expect(executedIds).toEqual(selectedIds);

    // The status endpoint reports back exactly the id that was submitted.
    const statusIds = await getStatusTestCaseIds(page, runDetail.run_id);
    expect(statusIds).toEqual(selectedIds);
  });

  test("a non-existent test_case_id is ignored and only the valid test runs", async ({ page }) => {
    await page.goto("/");

    const testCases = await listLoremTestCases(page);
    const [validId] = resolveTestCaseIds(testCases, [
      LOREM_TEST_CASE_NAMES.searchAuth,
    ]);
    // A syntactically-valid-looking id that does not match any test case.
    const nonExistentId = "0000000000000000dead-0000000000000000beef";
    const submittedIds = [validId, nonExistentId];

    const branch = generateUniqueBranchName("run-unknown-test-case-id");
    branchesToCleanup.push(branch);
    const testRunId = await triggerRunWithTestCaseIds(page, submittedIds, branch);
    test.info().annotations.push({
      type: "Test Run URL",
      description: `${page.url().split("/").slice(0, 3).join("/")}/lorem-ipsum/test-runs/${testRunId}`,
    });

    // The run still succeeds (reaches the `ended` state) despite the unknown id.
    const runDetail = await waitForRunEnded(page, testRunId);

    // Only the valid test ran; the unknown id was silently ignored.
    expect(runDetail.total_count).toBe(1);
    const executedIds = await getExecutedTestCaseIds(page, testRunId);
    expect(executedIds).toEqual([validId]);

    // The status endpoint echoes back the originally-submitted ids (including the
    // unknown one) since it reflects the trigger request payload.
    const statusIds = await getStatusTestCaseIds(page, runDetail.run_id);
    expect([...statusIds].sort()).toEqual([...submittedIds].sort());
  });

  test("a run where every test_case_id is unknown ends in error with no tests", async ({ page }) => {
    await page.goto("/");

    // Two well-formed ids that match no test case in the project.
    const unknownIds = [
      "0000000000000000dead-0000000000000000beef",
      "1111111111111111cafe-1111111111111111f00d",
    ];

    // The trigger itself still succeeds — the run is created.
    const branch = generateUniqueBranchName("run-all-unknown-test-case-ids");
    branchesToCleanup.push(branch);
    const testRunId = await triggerRunWithTestCaseIds(page, unknownIds, branch);
    test.info().annotations.push({
      type: "Test Run URL",
      description: `${page.url().split("/").slice(0, 3).join("/")}/lorem-ipsum/test-runs/${testRunId}`,
    });

    // With no matching tests, the Playwright filter selects nothing, so the run
    // settles into a terminal `error` state (not `ended`) and runs zero tests.
    const runDetail = await waitForRunTerminal(page, testRunId);
    expect(runDetail.state).toBe("error");
    expect(runDetail.total_count).toBe(0);
    const executedIds = await getExecutedTestCaseIds(page, testRunId);
    expect(executedIds).toEqual([]);

    // The status endpoint still echoes back the submitted (unknown) ids.
    const statusIds = await getStatusTestCaseIds(page, runDetail.run_id);
    expect([...statusIds].sort()).toEqual([...unknownIds].sort());
  });
});
