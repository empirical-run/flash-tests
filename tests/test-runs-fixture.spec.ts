import { test, expect } from "@playwright/test";
import { selectRunWithDistinctFailures } from "./pages/test-runs";

// Regression identity from source 47108: a resumed shard repeats the same case.
const searchId = "a088064de9fe351eef5f-323a0856242310234529";
const otherId = "b088064de9fe351eef5f-323a0856242310234529";
const duplicateFailures = [
  { pw_test_id: searchId, status: "failed", is_retrying: false },
  { pw_test_id: `${searchId}1`, status: "failed", is_retrying: false },
];

test("bulk fixture skips duplicate-only shards and requires distinct eligible cases", async () => {
  const candidates = [
    { id: 47108, state: "ended", failed_count: 2 },
    { id: 47107, state: "ended", failed_count: 5 },
  ];
  const detailsByRun = {
    47108: duplicateFailures,
    47107: [
      ...duplicateFailures,
      { pw_test_id: otherId, status: "failed" },
      {
        pw_test_id: "c".repeat(20) + "-" + "d".repeat(20),
        status: "failed",
        snooze_info: [{ id: 1 }],
      },
      {
        pw_test_id: "d".repeat(20) + "-" + "e".repeat(20),
        status: "failed",
        is_retrying: true,
      },
      { pw_test_id: "e".repeat(20) + "-" + "f".repeat(20), status: "passed" },
    ],
  };
  const inspected: number[] = [];
  const result = await selectRunWithDistinctFailures(
    candidates,
    async (id) => {
      inspected.push(id);
      return detailsByRun[id as keyof typeof detailsByRun];
    },
    2,
  );
  expect(inspected).toEqual([47108, 47107]);
  expect(result.testRunId).toBe(47107);
  expect(result.aggregateFailureCount).toBe(5);
  expect(result.distinctFailureCount).toBe(2);
  expect(result.expectedFailedTestIds).toEqual([searchId, otherId].sort());
});

test("bulk fixture rejects aggregate two when only one normalized failure exists", async () => {
  await expect(
    selectRunWithDistinctFailures(
      [{ id: 47108, state: "ended", failed_count: 2 }],
      async () => duplicateFailures,
      2,
    ),
  ).rejects.toThrow(/at least 2 distinct.*47108: 1 distinct/);
});
