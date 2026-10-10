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

type ShellWord = { value: string; literal: boolean; operator: boolean; substitutions: (string | null)[] };
type CommandPart = { words: ShellWord[]; following: ";" | "&&" | "||" | "|" | null };
type ShellWords = { parts: CommandPart[]; valid: boolean; syntax: boolean };
type InvocationIdentity = { kind: "match" | "unrelated" | "unsupported"; reason: string };

// Capture a substitution as an opaque, word-owned source context. This only
// finds bounded delimiters/quotes; it neither evaluates nor accepts its program.
function substitutionSource(command: string, start: number, budget = 12): { source: string; end: number } | null {
  if (budget === 0) return null;
  const dollar = command[start] === "$";
  const body = start + (dollar ? 2 : 1);
  let depth = 1;
  let quote: "'" | '"' | null = null;
  for (let index = body; index < command.length; index++) {
    const char = command[index];
    if (char === "\\" && quote !== "'") { index++; continue; }
    if (!dollar && char === "`") return quote ? null : { source: command.slice(body, index), end: index };
    if (quote === "'") { if (char === "'") quote = null; continue; }
    if ((char === "$" && command[index + 1] === "(") || char === "`") {
      const inner = substitutionSource(command, index, budget - 1);
      if (!inner) return null;
      index = inner.end;
      continue;
    }
    if (quote === '"') { if (char === '"') quote = null; continue; }
    if (char === "'" || char === '"') { quote = char; continue; }
    if (char === "#" && (index === body || /[\s;|&()]/.test(command[index - 1]))) {
      while (index + 1 < command.length && command[index + 1] !== "\n") index++;
      continue;
    }
    if (char === "(") depth++;
    if (char === ")" && --depth === 0) return { source: command.slice(body, index), end: index };
  }
  return null;
}

// Discovery only: retain executable positions and literal arguments separately.
// This does not evaluate expansions, substitutions, Node programs or shell code.
function discoverShellWords(command: string): ShellWords {
  const parts: CommandPart[] = [];
  let words: ShellWord[] = [];
  let value = "";
  let started = false;
  let literal = true;
  let quote: "'" | '"' | null = null;
  let valid = true;
  let substitutions: (string | null)[] = [];
  let syntax = false;
  const finishWord = () => {
    if (started) words.push({ value, literal, operator: false, substitutions });
    value = "";
    started = false;
    literal = true;
    substitutions = [];
  };
  for (let index = 0; index < command.length; index++) {
    const char = command[index];
    if (quote === "'") {
      if (char === "'") quote = null;
      else value += char;
      continue;
    }
    if (char === "\\" && (quote === '"' || quote === null)) {
      const next = command[index + 1];
      if (next === undefined) { valid = false; break; }
      if (quote === null || ['$', '`', '"', '\\', '\n'].includes(next)) {
        index++;
        if (next !== "\n") { value += next; started = true; }
      } else {
        // POSIX double quotes preserve \n in printf "%s\n", for example.
        value += char;
      }
      continue;
    }
    if ((char === "$" && command[index + 1] === "(") || char === "`") {
      const nested = substitutionSource(command, index);
      substitutions.push(nested?.source ?? null);
      literal = false;
      started = true;
      if (!nested) { value += command.slice(index); valid = false; break; }
      value += command.slice(index, nested.end + 1);
      index = nested.end;
      continue;
    }
    if (quote === '"') {
      if (char === '"') quote = null;
      else {
        if (char === "$" || char === "`") literal = false;
        value += char;
      }
      continue;
    }
    if (char === "'" || char === '"') { quote = char; started = true; continue; }
    if (char === "#" && !started) {
      // Comment text is not an executable position, even if it names the CLI.
      while (index + 1 < command.length && command[index + 1] !== "\n") index++;
      continue;
    }
    if (char === ";" || char === "\n" || char === "&" || char === "|") {
      finishWord();
      let following: CommandPart["following"] = ";";
      if (char === "&" || char === "|") {
        following = char === "|" ? "|" : "&&";
        if (command[index + 1] === char) { following = char === "|" ? "||" : "&&"; index++; }
        else if (char === "&") valid = false;
      }
      if (words.length === 0) {
        if (char !== "\n") valid = false;
      } else { parts.push({ words, following }); words = []; }
      continue;
    }
    if (char === ">" || char === "<") {
      finishWord();
      let operator = char;
      if (command[index + 1] === char) operator += command[++index];
      words.push({ value: operator, literal: true, operator: true, substitutions: [] });
      continue;
    }
    if (char === " " || char === "\t") { finishWord(); continue; }
    if (/[\s(){}]/.test(char)) syntax = true;
    if (/[\s$`*?\[\]]/.test(char)) literal = false;
    value += char;
    started = true;
  }
  if (quote) valid = false;
  finishWord();
  if (words.length > 0) parts.push({ words, following: null });
  else if (parts.length > 0 && parts[parts.length - 1].following !== ";") valid = false;
  return { parts, valid, syntax };
}

const jqStepListing = String.raw`.[] | "\(.callId)\t\(.apiName)\(if .error then " [FAILED]" else "" end)"`;
const literalArgumentCommands = ["echo", "printf", "curl", "which", "type"];
const executionWrappers = ["sh", "bash", "dash", "zsh", "ksh", "eval", "exec", "env", "sudo", "command", "safeBash", "safe-bash", "node", "python", "python3", "perl", "ruby"];
const values = (part: CommandPart) => part.words.map((word) => word.value);
const allLiteral = (part: CommandPart) => part.words.every((word) => word.literal && !word.operator);
const unsupported = (reason: string): InvocationIdentity => ({ kind: "unsupported", reason });

// Inspect the recorded reader/formatter strictly as DATA. No eval, Function,
// subprocess, filesystem read, or execution of this program in the helper.
function recordedNodeFormatter(path: string): string {
  return `const s=JSON.parse(require("fs").readFileSync(${JSON.stringify(path)},` +
    '"utf8")); console.log(`Total steps: ${s.length}`); for(const x of s) console.log(`${x.callId}\\t${x.apiName}${x.error ? " [FAILED]" : ""}`);';
}
function literalArtifactPath(path: string): boolean {
  return /^\/[A-Za-z0-9_./-]+$/.test(path) &&
    path.split("/").slice(1).every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

/** Discover executions first, then validate only the evidence-backed result forms. */
export function classifyTraceStepsCommand(command: string, archiveUrl: string, contextBudget = 12): InvocationIdentity {
  if (contextBudget === 0) return unsupported("Nested source exceeds the bounded discovery grammar");
  const discovered = discoverShellWords(command);
  const executions: { part: CommandPart; index: number; executable: number }[] = [];
  let potentialExecution = false;
  for (const [index, part] of discovered.parts.entries()) {
    // Assignment prefixes are discoverable, but not a supported result form.
    let executable = 0;
    while (part.words[executable]?.literal && /^[A-Za-z_][A-Za-z0-9_]*=/.test(part.words[executable].value)) executable++;
    const word = part.words[executable];
    if (!word) continue;
    const args = part.words.slice(executable + 1);
    // Classify each substitution's OWN source, never correlate a sibling prose
    // argument with it. Only known non-invoking contexts can be excluded safely.
    for (const token of part.words) {
      for (const source of token.substitutions) {
        if (source === null) return unsupported("Ambiguous or unterminated substitution source");
        const nested = discoverShellWords(source);
        const knownNonInvoking = nested.valid && !nested.syntax && nested.parts.length > 0 && nested.parts.every(({ words }) => {
          const head = words[0];
          const mode = words[1];
          return head?.literal && !head.operator &&
            (literalArgumentCommands.includes(head.value) || head.value === "true" ||
              (head.value === "command" && mode?.literal && mode.value === "-v") ||
              (head.value === "trace-utils" && mode?.literal && !mode.operator && mode.value !== "steps"));
        });
        const identity = classifyTraceStepsCommand(source, archiveUrl, contextBudget - 1);
        if (!knownNonInvoking || identity.kind !== "unrelated") return unsupported(`Actual or ambiguous CLI execution in substitution context: ${identity.reason}`);
      }
    }
    if (word.literal && word.value === "trace-utils") {
      const mode = args[0];
      if (!mode?.literal || mode.operator) return unsupported("Known trace-utils executable has a missing/nonliteral/ambiguous mode");
      if (mode.value === "steps") executions.push({ part, index, executable });
      continue;
    }
    if (literalArgumentCommands.includes(word.value) ||
      (word.value === "command" && args[0]?.value === "-v")) continue;
    // Unknown wrappers/paths/dynamic executable names cannot be silently ignored.
    const namesCli = args.some((arg) => /\btrace-utils\b/.test(arg.value));
    const stepsArguments = args.some((arg) => arg.value === "steps") && args.some((arg) => arg.value === "--file");
    if ((/\btrace-utils\b/.test(word.value) && word.value !== "trace-utils") ||
      (/\/trace-utils$/.test(word.value) && args[0]?.value === "steps") ||
      (executionWrappers.includes(word.value) && namesCli) ||
      (!word.literal && (stepsArguments || command.includes(archiveUrl))) ||
      (stepsArguments && args.some((arg) => arg.value === archiveUrl)) ||
      args.some((arg) => arg.value === "trace-utils")) potentialExecution = true;
  }
  if (potentialExecution) return unsupported("Potential wrapped/indirect/dynamic execution cannot be validated by the supported grammar");
  if (executions.length === 0) return { kind: "unrelated", reason: "No trace-utils steps executable position; arguments/prose/probes are not execution" };
  if (!discovered.valid || discovered.syntax) return unsupported("Malformed or ambiguous shell syntax around a discovered steps execution");
  if (executions.length !== 1) return unsupported("Multiple steps executions in one card have no supported card-local output identity");
  const { part: invocation, index: invocationIndex, executable } = executions[0];
  if (executable !== 0) return unsupported("Assignment-prefixed steps execution is not a supported result form");
  const words = values(invocation);
  const fileWord = invocation.words[3];
  if (words[2] !== "--file" || !fileWord?.literal || fileWord.operator) return unsupported("Steps execution must have a literal --file archive argument");
  if (fileWord.value !== archiveUrl) return { kind: "unrelated", reason: "Steps execution targets a different literal archive" };
  if (invocation.words.some((word) => !word.literal)) return unsupported("Expansions/globs in an exact-archive execution are not supported");
  for (let index = 0; index < invocationIndex; index++) {
    const prefix = discovered.parts[index];
    const prefixWords = values(prefix);
    if (!allLiteral(prefix) || prefixWords.length !== 3 || prefixWords[0] !== "command" ||
      prefixWords[1] !== "-v" || !["safeBash", "trace-utils"].includes(prefixWords[2])) return unsupported("Only recorded command-v prefixes may precede the steps result");
    if (prefix.following === "||") {
      const fallback = discovered.parts[++index];
      if (index >= invocationIndex || !allLiteral(fallback) || values(fallback).join(" ") !== "true" || fallback.following !== ";") return unsupported("Unsupported command-v fallback/prefix control flow");
    } else if (prefix.following !== ";") return unsupported("Unsupported command-v prefix separator");
  }
  const suffix = discovered.parts.slice(invocationIndex + 1);
  const redirect = words.length === 7 && words[4] === "--json" &&
    invocation.words[5].operator && words[5] === ">" && !invocation.words[6].operator;
  if (redirect) {
    const path = words[6];
    if (!literalArtifactPath(path)) return unsupported("Redirect target must be an unambiguous literal artifact path");
    if (invocation.following !== "&&" || suffix.length !== 1) return unsupported("Artifact flow requires exactly one && Node reader; no overwrite/intermediate/tail commands");
    const reader = suffix[0];
    const readerWords = values(reader);
    if (!allLiteral(reader) || readerWords.length !== 3 || readerWords[0] !== "node" || readerWords[1] !== "-e" ||
      ![null, ";"].includes(reader.following)) return unsupported("Artifact reader must be the single recorded literal node -e form");
    if (readerWords[2] !== recordedNodeFormatter(path)) return unsupported("Node reader path/formatter differs from the recorded same-path JSON formatter");
    return { kind: "match", reason: "Exact-archive JSON writer and recorded same-literal-path Node JSON reader/formatter" };
  }
  const json = words.length === 5 && words[4] === "--json";
  if (!allLiteral(invocation) || (words.length !== 4 && !json)) return unsupported("Unsupported flags/redirection in exact-archive steps execution");
  if (suffix.length > 0) {
    const listing = suffix[0];
    const listingWords = values(listing);
    if (!json || invocation.following !== "|" || suffix.length !== 1 || !allLiteral(listing) ||
      listingWords.length !== 3 || listingWords[0] !== "jq" || listingWords[1] !== "-r" ||
      listingWords[2] !== jqStepListing || ![null, ";"].includes(listing.following)) return unsupported("Only the recorded jq step-listing pipeline is supported; no arbitrary tail");
  } else if (![null, ";"].includes(invocation.following)) return unsupported("Unsupported control flow after steps execution");
  return { kind: "match", reason: json ? "Direct exact-archive JSON steps" : "Direct exact-archive text steps" };
}

export function traceStepsInvocation(command: string, archiveUrl: string): InvocationIdentity["kind"] {
  return classifyTraceStepsCommand(command, archiveUrl).kind;
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
    const inputText = await inputCode.innerText();
    expect(() => JSON.parse(inputText), "Native bash Input must be valid JSON").not.toThrow();
    const toolInput = JSON.parse(inputText) as { command?: unknown } | null;
    expect(typeof toolInput?.command, "Native bash command in full Input").toBe("string");
    const identity = classifyTraceStepsCommand(toolInput!.command as string, archiveUrl);
    expect(identity.kind, `Full Input execution identity: ${identity.reason}`).not.toBe("unsupported");
    candidates.push({ card, input, output, invocation: identity.kind });
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
