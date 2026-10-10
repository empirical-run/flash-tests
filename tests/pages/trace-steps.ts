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

type CommandPart = { words: string[]; following: ";" | "&&" | "||" | "|" | null };

// Deliberately narrow shell scanner, not a general shell parser. Quotes keep
// separators literal. Expansions, redirects, escapes outside quotes and other
// ambiguous syntax are unsupported, never evidence of an executed invocation.
function commandParts(command: string): CommandPart[] | null {
  const parts: CommandPart[] = [];
  let words: string[] = [];
  let word = "";
  let started = false;
  let quote: "'" | '"' | null = null;
  const finishWord = () => {
    if (started) words.push(word);
    word = "";
    started = false;
  };
  for (let index = 0; index < command.length; index++) {
    const char = command[index];
    if (quote === "'") {
      if (char === "'") quote = null;
      else word += char;
    } else if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === "$" || char === "`") return null;
      else if (char === "\\") {
        const next = command[++index];
        if (next !== '"' && next !== "\\") return null;
        word += next;
      } else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === ";" || char === "\n" || char === "&" || char === "|") {
      finishWord();
      let following: CommandPart["following"] = ";";
      if (char === "&" || char === "|") {
        following = char === "|" ? "|" : "&&";
        if (command[index + 1] === char) following = char === "|" ? "||" : "&&";
        else if (char === "&") return null;
        if (command[index + 1] === char) index++;
      }
      if (words.length === 0) {
        if (char === "\n") continue;
        return null;
      }
      parts.push({ words, following });
      words = [];
    } else if (/\s/.test(char)) {
      finishWord();
    } else {
      if (/[\\$`<>(){}*?\[\]#]/.test(char)) return null;
      word += char;
      started = true;
    }
  }
  if (quote) return null;
  finishWord();
  if (words.length > 0) parts.push({ words, following: null });
  else if (parts.length > 0 && parts[parts.length - 1].following !== ";") return null;
  return parts;
}

const jqStepListing = String.raw`.[] | "\(.callId)\t\(.apiName)\(if .error then " [FAILED]" else "" end)"`;

/** Only direct text/JSON steps, known command-v prefixes and the observed jq listing. */
export function traceStepsInvocation(
  command: string,
  archiveUrl: string,
): "match" | "unrelated" | "unsupported" {
  const parts = commandParts(command);
  if (!parts) return command.includes("trace-utils") ? "unsupported" : "unrelated";
  const invocations = parts.filter(({ words }) => words[0] === "trace-utils");
  if (invocations.length === 0) {
    // Echo/printf arguments and command-v checks do not execute the named CLI.
    const literalsOnly = parts.every(({ words }) =>
      ["echo", "printf", "true"].includes(words[0]) ||
      (words[0] === "command" && words[1] === "-v"),
    );
    return command.includes("trace-utils") && !literalsOnly ? "unsupported" : "unrelated";
  }
  if (invocations.length !== 1) return "unsupported";
  const invocation = invocations[0];
  const invocationIndex = parts.indexOf(invocation);
  // Known prefix: command -v safeBash/trace-utils [|| true]; before the CLI.
  for (let index = 0; index < invocationIndex; index++) {
    const part = parts[index];
    if (part.words.length !== 3 || part.words[0] !== "command" ||
      part.words[1] !== "-v" || !["safeBash", "trace-utils"].includes(part.words[2])) return "unsupported";
    if (part.following === "||") {
      const fallback = parts[++index];
      if (index >= invocationIndex || fallback.words.join(" ") !== "true" || fallback.following !== ";") return "unsupported";
    } else if (part.following !== ";") return "unsupported";
  }
  const words = invocation.words;
  const json = words.length === 5 && words[4] === "--json";
  if (words[1] !== "steps" || words[2] !== "--file" ||
    (words.length !== 4 && !json)) return "unsupported";
  const suffix = parts.slice(invocationIndex + 1);
  if (suffix.length > 0) {
    if (!json || invocation.following !== "|" || suffix.length !== 1 ||
      suffix[0].words.length !== 3 || suffix[0].words[0] !== "jq" ||
      suffix[0].words[1] !== "-r" || suffix[0].words[2] !== jqStepListing ||
      ![null, ";"].includes(suffix[0].following)) return "unsupported";
  } else if (![null, ";"].includes(invocation.following)) return "unsupported";
  return words[3] === archiveUrl ? "match" : "unrelated";
}

/** Validate each exact-archive native card independently, then require ID consensus. */
export async function getTraceStepResults(
  messages: Locator,
  archiveUrl: string,
): Promise<{
  results: { card: Locator; input: Locator; output: Locator; failedSteps: string[] }[];
  failedSteps: string[];
}> {
  await expandToolGroups(messages);
  const calls = messages.getByTestId("used-bash");
  await expect.poll(() => calls.filter({ visible: true }).count()).toBeGreaterThan(0);
  const candidates = [];
  for (const call of await calls.all()) {
    const card = call.locator("..");
    const details = card.getByTestId("inline-tool-details");
    // Re-clicking an already-open native panel would collapse it.
    if ((await details.count()) === 0) await call.click();
    await expect(details).toHaveCount(1);
    const input = details.getByRole("heading", { name: "Input", exact: true }).locator("..");
    const output = details.getByRole("heading", { name: "Output", exact: true }).locator("..");
    await expect(input).toHaveCount(1);
    await expect(output).toHaveCount(1);
    const inputCode = input.locator("pre");
    await expect(inputCode).toHaveCount(1);
    // Native bash Input is JSON. Malformed/ambiguous input must fail, not be skipped.
    const toolInput = JSON.parse(await inputCode.innerText()) as { command?: unknown };
    expect(typeof toolInput.command, "Native bash command in full Input").toBe("string");
    const invocation = traceStepsInvocation(toolInput.command as string, archiveUrl);
    expect(invocation, "Supported, unambiguous CLI identity in full Input").not.toBe("unsupported");
    candidates.push({ card, input, output, invocation });
  }
  const matched = candidates.filter(({ invocation }) => invocation === "match");
  expect(matched.length, "Exact-archive trace-utils native cards").toBeGreaterThan(0);
  const results = [];
  for (const { card, input, output } of matched) {
    await expect(card.getByTestId("inline-tool-details")).toHaveCount(1);
    await expect(input).toBeVisible();
    await expect(output).toBeVisible();
    await expect(output).toContainText(traceStepId);
    // No output concatenation, best-result selection or skipping unparsable calls.
    const failedSteps = [...new Set(failedTraceStepIds(await output.innerText()))].sort();
    results.push({ card, input, output, failedSteps });
  }
  const failedSteps = [...new Set(results.flatMap((result) => result.failedSteps))].sort();
  for (const result of results) {
    expect(result.failedSteps, "Every card must agree on the normalized failed-ID set").toEqual(failedSteps);
  }
  return { results, failedSteps };
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
