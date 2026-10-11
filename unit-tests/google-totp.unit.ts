import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  completeTotpChallenge,
  MAX_TOTP_SUBMISSIONS,
  MIN_TOTP_REMAINING_MS,
  TOTP_BOUNDARY_BUFFER_MS,
  TOTP_WINDOW_MS,
  totpSubmissionDelay,
  type TotpOutcome,
} from "../tests/pages/google-totp-policy";

// Fake clock/outcomes only: no real credentials, OTP values or browser needed.
function scenario(start: number, outcomes: Array<TotpOutcome | Error>) {
  let now = start;
  const waits: number[] = [];
  const submissions: number[] = [];
  let preparations = 0;
  let outcomeIndex = 0;
  const io = {
    now: () => now,
    wait: async (milliseconds: number) => {
      waits.push(milliseconds);
      now += milliseconds;
    },
    prepare: async () => {
      preparations++;
    },
    submit: async () => {
      submissions.push(Math.floor(now / TOTP_WINDOW_MS));
    },
    outcome: async () => {
      const outcome = outcomes[outcomeIndex++];
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  };
  return { io, waits, submissions, preparations: () => preparations };
}

void test("a healthy window submits immediately, without a fixed post-generation delay", async () => {
  const s = scenario(6_000, ["callback"]);
  await completeTotpChallenge(s.io);
  assert.deepEqual(s.waits, []);
  assert.deepEqual(s.submissions, [0]);
  assert.equal(s.preparations(), 1);
});

void test("near-expiry submission waits until the next window plus a boundary buffer", async () => {
  const s = scenario(29_339, ["callback"]);
  await completeTotpChallenge(s.io);
  assert.deepEqual(s.waits, [
    TOTP_WINDOW_MS + TOTP_BOUNDARY_BUFFER_MS - 29_339,
  ]);
  assert.deepEqual(s.submissions, [1]);
});

void test("the exact minimum-remaining boundary waits; one millisecond above it does not", () => {
  const threshold = TOTP_WINDOW_MS - MIN_TOTP_REMAINING_MS;
  assert.equal(
    totpSubmissionDelay(threshold),
    MIN_TOTP_REMAINING_MS + TOTP_BOUNDARY_BUFFER_MS,
  );
  assert.equal(totpSubmissionDelay(threshold - 1), 0);
  assert.equal(totpSubmissionDelay(TOTP_WINDOW_MS), 0);
});

void test("an explicit consumed/wrong code permits only one fresh next-window submission", async () => {
  const s = scenario(10_162, ["wrong-code", "callback"]);
  await completeTotpChallenge(s.io);
  assert.deepEqual(s.submissions, [0, 1]);
  assert.deepEqual(s.waits, [20_088]);
  assert.equal(s.preparations(), 2);
});

void test("a rejection already in a later safe window does not wait an extra window", () => {
  assert.equal(totpSubmissionDelay(36_000, 0), 0);
  assert.equal(totpSubmissionDelay(36_000, 1), 24_250);
});

void test("two explicit rejections fail, never silently retrying a third code", async () => {
  const s = scenario(6_000, ["wrong-code", "wrong-code", "callback"]);
  await assert.rejects(completeTotpChallenge(s.io), /both TOTP submissions/);
  assert.equal(s.submissions.length, MAX_TOTP_SUBMISSIONS);
  assert.deepEqual(s.submissions, [0, 1]);
});

void test("arbitrary authentication/callback failures propagate without OTP retry", async () => {
  const failure = new Error("Callback timeout / CAPTCHA / app unavailable");
  const s = scenario(6_000, [failure, "callback"]);
  await assert.rejects(
    completeTotpChallenge(s.io),
    (error) => error === failure,
  );
  assert.deepEqual(s.submissions, [0]);
  assert.deepEqual(s.waits, []);
});

void test("submission errors also propagate without another attempt", async () => {
  const s = scenario(6_000, ["callback"]);
  s.io.submit = async () => {
    throw new Error("Google Next action failed");
  };
  await assert.rejects(completeTotpChallenge(s.io), /Next action failed/);
  assert.deepEqual(s.waits, []);
});
