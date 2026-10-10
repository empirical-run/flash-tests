import { expect, Locator } from "@playwright/test";
import { expandToolGroups } from "./sessions";

// Actual action/assertion IDs, not an array-length probe or fixture-only output.
export const traceStepId = /\b(?:pw:api|test\.step|expect)@\d+\b/;
const entryBoundary = String.raw`\b(?:pw:api|test\.step|expect|fixture|hook)@\d+\b`;
const entryText = `(?:(?!${entryBoundary})[\\s\\S])*?`;
// A failed action/assertion within its own entry. The seeded search scenario
// can fail at different steps; null errors and later entries must not qualify it.
const failedTraceStep = new RegExp(
  `\\b((?:pw:api|test\\.step|expect)@\\d+)\\b${entryText}(?:\\bFAILED\\b|"error"\\s*:\\s*(?:"[^"]|\\{)|\\bError:)`,
  "i",
);

// Match a real CLI invocation and its exact --file argument in the full Input,
// not a truncated summary, command-v probe, quoted echo, or URL-prefix match.
function traceStepsCommand(archiveUrl: string): RegExp {
  const archive = archiveUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|[;&|\\n]|"command"\\s*:\\s*")[ \t]*trace-utils[ \t]+steps(?=[ \t])` +
      `[^;&|\\r\\n]*?[ \t]--file[ \t]+(?:'${archive}'|"${archive}"|${archive}(?=[ \t\\r\\n"';&|]|$))`,
  );
}

/** Completed bash results for this exact archive, within one response turn. */
export function traceStepResults(
  messages: Locator,
  archiveUrl: string,
): Locator {
  const page = messages.page();
  const input = page
    .getByRole("heading", { name: "Input", exact: true })
    .locator("..");
  const output = page
    .getByRole("heading", { name: "Output", exact: true })
    .locator("..");
  return messages
    .getByTestId("used-bash")
    .locator("..")
    .filter({ has: input.filter({ hasText: traceStepsCommand(archiveUrl) }) })
    .filter({ has: output.filter({ hasText: traceStepId }) })
    .filter({ has: output.filter({ hasText: failedTraceStep }) });
}

/** Expand completed calls, then select by their own Input AND real step Output. */
export async function getTraceStepResult(
  messages: Locator,
  archiveUrl: string,
): Promise<{
  input: Locator;
  output: Locator;
}> {
  await expandToolGroups(messages);
  // Open each completed bash card to inspect its full Input, including prefixed
  // commands whose summaries never reach the trace-utils invocation.
  const calls = messages.getByTestId("used-bash");
  await expect.poll(() => calls.filter({ visible: true }).count()).toBeGreaterThan(0);
  for (const call of await calls.all()) {
    const details = call.locator("..").getByTestId("inline-tool-details");
    // A completed call can already be open; clicking it again would collapse it.
    if ((await details.count()) === 0) {
      await call.click();
    }
  }

  // Require a single content-qualified call: duplicates must not silently win
  // by ordinal, and later probes cannot replace the real failed-step output.
  const result = traceStepResults(messages, archiveUrl);
  await expect(result).toHaveCount(1);
  await expect(result).toBeVisible();
  const details = result.getByTestId("inline-tool-details");
  return {
    input: details
      .getByRole("heading", { name: "Input", exact: true })
      .locator(".."),
    output: details
      .getByRole("heading", { name: "Output", exact: true })
      .locator(".."),
  };
}

/** Failed action/assertion IDs, never fixtures or an earlier successful entry. */
export function failedTraceStepIds(output: string): string[] {
  const matches = [
    ...output.matchAll(new RegExp(failedTraceStep.source, "gi")),
  ];
  expect(
    matches.length,
    "Failed action/assertion in actual trace-utils output",
  ).toBeGreaterThan(0);
  return matches.map((match) => match[1]);
}
