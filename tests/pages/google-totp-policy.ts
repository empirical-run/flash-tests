// Google Authenticator / authenticator@1.1.5 use 30-second TOTP counters.
export const TOTP_WINDOW_MS = 30_000;
// Leave 10s of headroom for fill/click and network latency, rather than relying
// on Google's acceptance of a previous-window code. This is a safety margin,
// not a claim about Google's expiry tolerance or protection from clock skew.
export const MIN_TOTP_REMAINING_MS = 10_000;
// Wake just inside the new counter, avoiding exact-boundary timer/rounding races.
export const TOTP_BOUNDARY_BUFFER_MS = 250;
export const MAX_TOTP_SUBMISSIONS = 2;

export type TotpOutcome = "callback" | "wrong-code";

/** Wait out a nearly expired or already-submitted counter; never reuse it. */
export function totpSubmissionDelay(
  now: number,
  previousCounter?: number,
): number {
  const counter = Math.floor(now / TOTP_WINDOW_MS);
  const remaining = TOTP_WINDOW_MS - (now % TOTP_WINDOW_MS);
  const nextCounter = Math.max(counter + 1, (previousCounter ?? -1) + 1);
  if (
    counter <= (previousCounter ?? -1) ||
    remaining <= MIN_TOTP_REMAINING_MS
  ) {
    return nextCounter * TOTP_WINDOW_MS + TOTP_BOUNDARY_BUFFER_MS - now;
  }
  return 0;
}

/** Only Google's explicit wrong-code outcome permits one next-window retry. */
export async function completeTotpChallenge(io: {
  now: () => number;
  wait: (milliseconds: number) => Promise<void>;
  prepare: () => Promise<void>;
  submit: () => Promise<void>;
  outcome: (submission: number) => Promise<TotpOutcome>;
}): Promise<void> {
  let previousCounter: number | undefined;
  for (let attempt = 0; attempt < MAX_TOTP_SUBMISSIONS; attempt++) {
    await io.prepare();
    const delay = totpSubmissionDelay(io.now(), previousCounter);
    if (delay > 0) await io.wait(delay);
    previousCounter = Math.floor(io.now() / TOTP_WINDOW_MS);
    await io.submit();
    const outcome = await io.outcome(attempt);
    if (outcome === "callback") return;
    if (outcome !== "wrong-code")
      throw new Error("Unexpected Google TOTP outcome");
  }
  throw new Error("Google rejected both TOTP submissions in distinct windows");
}
