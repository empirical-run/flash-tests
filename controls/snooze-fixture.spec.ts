import { test, expect, type Page, type APIResponse } from "@playwright/test";
import { deleteSnoozeFixture } from "../tests/pages/snooze-fixture";

const branch = "flash-snooze-fixture-12345678-1234-1234-1234-123456789abc";
const exactRef = `refs/heads/${branch}`;
type Reply = Pick<APIResponse, "ok" | "status" | "headers" | "json">;

function response(
  status: number,
  raw: string,
  contentType = "application/json",
): Reply {
  return {
    headers: () => ({ "content-type": contentType }),
    status: () => status,
    ok: () => status >= 200 && status < 300,
    json: async () => JSON.parse(raw),
  };
}

function fakePage(...reads: (Reply | Error)[]) {
  const calls: { method: string; url: string; timeout?: number }[] = [];
  let readIndex = 0;
  const page = {
    request: {
      post: async (
        _url: string,
        options: { data: { method: string; url: string }; timeout?: number },
      ) => {
        calls.push({ ...options.data, timeout: options.timeout });
        if (options.data.method === "DELETE") {
          return response(200, "null");
        }
        const reply = reads[Math.min(readIndex++, reads.length - 1)];
        if (reply instanceof Error) {
          throw reply;
        }
        return reply;
      },
    },
  } as unknown as Page;
  return { page, calls };
}

const present = () => response(200, JSON.stringify([{ ref: exactRef }]));
const absent = () => response(200, "[]");

// Run explicitly with --config=playwright.controls.config.ts. These controls are
// outside the live suite's tests/ directory and never contact GitHub/the app.
test("stale healthy ref then absence passes with one DELETE", async () => {
  const { page, calls } = fakePage(present(), absent());
  await deleteSnoozeFixture(page, branch);
  expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET", "GET"]);
  expect(calls[0].url).toBe(
    `/repos/empirical-run/lorem-ipsum-tests/git/refs/heads/${branch}`,
  );
  expect(calls.slice(1).map((call) => call.url)).toEqual([
    `/repos/empirical-run/lorem-ipsum-tests/git/matching-refs/heads/${branch}`,
    `/repos/empirical-run/lorem-ipsum-tests/git/matching-refs/heads/${branch}`,
  ]);
});

test("persistent exact ref fails at the documented 10-second budget", async () => {
  const { page, calls } = fakePage(present());
  await expect(deleteSnoozeFixture(page, branch)).rejects.toThrow(
    `Fixture branch ${branch} still exists after 10 seconds`,
  );
  expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(1);
  expect(calls.filter((call) => call.method === "GET").length).toBeGreaterThan(
    1,
  );
  expect(calls.slice(1).every((call) => call.timeout! <= 5_000)).toBe(true);
});

test("a longer foreign prefix ref is not the exact owned ref", async () => {
  const { page, calls } = fakePage(
    response(200, JSON.stringify([{ ref: `${exactRef}-someone-else` }])),
  );
  await deleteSnoozeFixture(page, branch);
  expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET"]);
});

for (const status of [401, 403, 500, 502, 404]) {
  test(`ref read HTTP ${status} fails immediately without retry`, async () => {
    const { page, calls } = fakePage(response(status, '{"error":"provider"}'));
    await expect(deleteSnoozeFixture(page, branch)).rejects.toThrow(
      "Ref read must return healthy HTTP 200",
    );
    expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET"]);
  });
}

test("HTTP200 HTML is not a healthy JSON response", async () => {
  const { page, calls } = fakePage(response(200, "[]", "text/html"));
  await expect(deleteSnoozeFixture(page, branch)).rejects.toThrow(
    "Ref read must be JSON",
  );
  expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET"]);
});

test("malformed JSON fails immediately without retry", async () => {
  const { page, calls } = fakePage(response(200, "not-json"));
  await expect(deleteSnoozeFixture(page, branch)).rejects.toThrow(SyntaxError);
  expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET"]);
});

test("HTTP200 error object is not a healthy ref list", async () => {
  const { page, calls } = fakePage(response(200, '{"error":"not a list"}'));
  await expect(deleteSnoozeFixture(page, branch)).rejects.toThrow(
    "Ref read must return a JSON ref array",
  );
  expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET"]);
});

test("malformed ref entry fails immediately without retry", async () => {
  const { page, calls } = fakePage(response(200, '[{"ref":null}]'));
  await expect(deleteSnoozeFixture(page, branch)).rejects.toThrow(
    "Each ref must have a string name",
  );
  expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET"]);
});

test("an empty ref name fails immediately without retry", async () => {
  const { page, calls } = fakePage(response(200, '[{"ref":""}]'));
  await expect(deleteSnoozeFixture(page, branch)).rejects.toThrow(
    "Each ref must name a branch",
  );
  expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET"]);
});

test("transport error fails immediately without retry", async () => {
  const { page, calls } = fakePage(new Error("transport failed"));
  await expect(deleteSnoozeFixture(page, branch)).rejects.toThrow(
    "transport failed",
  );
  expect(calls.map((call) => call.method)).toEqual(["DELETE", "GET"]);
});
