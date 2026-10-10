/* global Map, Set */
import { createHash } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";

export const MEMORY_KEY = "arjun-comms-preferences";
export const INITIAL_LANGUAGE = "Portuguese";
export const UPDATED_LANGUAGES = ["Spanish", "French", "German"] as const;

export type Memory = {
  id: number;
  project_id: number;
  name: string;
  description: string;
  content: string;
  source_chat_session_id: number;
  deleted_at: string | null;
};
export type MemoryVersion = {
  id: number;
  memory_id: number;
  version: number;
  name: string;
  description: string;
  content: string;
  source_chat_session_id: number;
  created_at: string;
};
export type WorkerMetadata = {
  id: number;
  project_id: number;
  mode: string;
  source: string;
  created_by: string;
  title: string;
  created_at: string;
  is_closed: boolean;
  chat_state: { error?: unknown };
};
export type ToolCall = {
  type: "toolCall";
  id: string;
  name: string;
  arguments: { name?: string; description?: string; content?: string };
};
type Content = ToolCall | { type: string; text?: string };
export type Entry = {
  id: string;
  log_seq: number;
  timestamp: string;
  type: string;
  customType?: string;
  data?: { content?: string };
  message?: {
    role: string;
    content: Content[];
    toolName?: string;
    toolCallId?: string;
    isError?: boolean;
    stopReason?: string;
  };
};
export type SaveProof = {
  call: ToolCall;
  result: Entry;
  memoryID: number;
  operation: string;
};

export async function memoryAuth(page: Page) {
  expect(
    Number(process.env.LOREM_IPSUM_PROJECT_ID),
    "Exact-key fixture is approved only for Lorem Ipsum project 3",
  ).toBe(3);
  const headers = await getApiWorkerAuthHeaders(page);
  const jwt = headers.Authorization.replace(/^Bearer /, "").split(".");
  const { sub: userID, email } = JSON.parse(
    Buffer.from(jwt[1], "base64url").toString("utf8"),
  );
  expect(process.env.AUTOMATED_USER_EMAIL).toEqual(expect.any(String));
  expect(
    email,
    "Historical fixtures must belong to the automated test account",
  ).toBe(process.env.AUTOMATED_USER_EMAIL);
  expect(userID).toEqual(expect.any(String));
  return { headers, userID: userID as string };
}

async function read(page: Page, path: string) {
  const { headers } = await memoryAuth(page);
  const response = await page.request.get(`${getApiBaseUrl()}${path}`, {
    headers,
  });
  expect(response.status(), `Healthy read: ${path}`).toBe(200);
  return response.json();
}

export async function listMemories(page: Page, includeDeleted: boolean) {
  const memories: Memory[] = [];
  const pages: unknown[] = [];
  let totalPages = 1;
  let total = 0;
  for (let n = 1; n <= totalPages; n++) {
    const body = await read(
      page,
      `/api/memories?page=${n}&per_page=100${includeDeleted ? "&include_deleted=true" : ""}`,
    );
    expect(body.pagination.page).toBe(n);
    expect(body.data.memories).toEqual(expect.any(Array));
    totalPages = body.pagination.total_pages;
    total = body.pagination.total;
    expect(totalPages).toBeGreaterThanOrEqual(1);
    pages.push(body.pagination);
    memories.push(...body.data.memories);
  }
  expect(
    memories.length,
    "Complete memory pagination; stop on a changing/incomplete snapshot",
  ).toBe(total);
  expect(new Set(memories.map((m) => m.id)).size).toBe(memories.length);
  expect(memories.every((m) => m.project_id === 3)).toBe(true);
  return { memories, pages };
}

export async function readVersions(
  page: Page,
  id: number,
): Promise<MemoryVersion[]> {
  const body = await read(page, `/api/memories/${id}/versions`);
  const versions: MemoryVersion[] = body.data.versions;
  expect(versions).toEqual(expect.any(Array));
  expect(versions.length).toBeGreaterThan(0);
  expect(
    versions.every((v) => v.memory_id === id && v.name === MEMORY_KEY),
  ).toBe(true);
  expect(new Set(versions.map((v) => v.version)).size).toBe(versions.length);
  return [...versions].sort((a, b) => a.version - b.version);
}

export async function readWorker(
  page: Page,
  id: number,
  closed: boolean,
): Promise<WorkerMetadata> {
  const body = await read(page, `/api/chat-sessions/${id}`);
  const worker: WorkerMetadata = body.data.chat_session;
  const { userID } = await memoryAuth(page);
  expect(worker).toMatchObject({
    id,
    project_id: 3,
    mode: "worker",
    source: "dashboard",
    created_by: userID,
    is_closed: closed,
  });
  expect(worker.title.trim()).not.toBe("");
  return worker;
}

export async function readLedger(page: Page, id: number): Promise<Entry[]> {
  const entries: Entry[] = [];
  let totalPages = 1;
  let total = 0;
  for (let n = 1; n <= totalPages; n++) {
    const body = await read(
      page,
      `/api/chat-sessions/${id}/session-state?page=${n}&per_page=100`,
    );
    totalPages = body.pagination.total_pages;
    total = body.pagination.total;
    expect(body.pagination.page).toBe(n);
    entries.push(...body.data.entries);
  }
  expect(
    entries.length,
    "Complete source ledger is required to establish ownership",
  ).toBe(total);
  expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  return entries.sort((a, b) => a.log_seq - b.log_seq);
}

export function entryText(entry: Entry): string {
  return (entry.message?.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("\n");
}

export function toolCalls(entries: Entry[]): ToolCall[] {
  return entries.flatMap((e) =>
    (e.message?.content ?? []).filter(
      (c): c is ToolCall => c.type === "toolCall",
    ),
  );
}

export function completedAssistant(
  entries: Entry[],
  cutoff: number,
): Entry | undefined {
  return entries
    .filter(
      (e) =>
        e.log_seq > cutoff &&
        e.message?.role === "assistant" &&
        e.message.stopReason === "stop" &&
        entryText(e).trim() &&
        !toolCalls([e]).length,
    )
    .at(-1);
}

export function saveProof(
  entries: Entry[],
  description: string,
  content: string,
): SaveProof {
  const calls = toolCalls(entries).filter(
    (c) => c.name === "save_memory" && c.arguments.name === MEMORY_KEY,
  );
  expect(calls, "Exactly one actual save for this fixture worker").toHaveLength(
    1,
  );
  const call = calls[0];
  expect(call.arguments).toEqual({ name: MEMORY_KEY, description, content });
  const results = entries.filter(
    (e) => e.message?.role === "toolResult" && e.message.toolCallId === call.id,
  );
  expect(results).toHaveLength(1);
  const result = results[0];
  expect(result.message).toMatchObject({
    toolName: "save_memory",
    isError: false,
  });
  const match = entryText(result).match(
    /^(Saved|Updated) memory "arjun-comms-preferences" \(id (\d+)\)/,
  );
  expect(
    match,
    "Tool result must identify the exact persisted memory, not assistant prose",
  ).not.toBeNull();
  return { call, result, memoryID: Number(match![2]), operation: match![1] };
}

export function memoryDescription(marker: string) {
  return `Arjun's preferred communication language (${marker})`;
}
export function memoryContent(marker: string, language: string) {
  return `Arjun's preferred language is ${language}. Fixture owner: ${marker}.`;
}

/** Only this fixture family (including its older local-pilot marker) may be reused. */
function fixtureMarker(description: string): string {
  const match = description.match(
    /^Arjun's preferred communication language \((flash-tests:worker-memory-refresh:[a-f0-9-]{36}|local E2E pilot \d+)\)$/,
  );
  expect(
    match,
    "STOP: unknown exact-key record; no overwrite/delete is authorized",
  ).not.toBeNull();
  return match![1];
}

/** Read-only provenance validation. No ID allowlist, creation, restore or deletion. */
export async function proveHistoricalTombstone(page: Page, memory: Memory) {
  expect(memory).toMatchObject({ project_id: 3, name: MEMORY_KEY });
  expect(
    memory.deleted_at,
    "STOP: an active exact-key memory must never be overwritten",
  ).toEqual(expect.any(String));
  const versions = await readVersions(page, memory.id);
  const groups = new Map<string, MemoryVersion[]>();
  const sources = new Set<number>();
  const sourceLedgers = new Map<number, Entry[]>();
  expect(
    versions.map((version) => version.version),
    "Complete contiguous historical revisions required",
  ).toEqual(versions.map((_, index) => index + 1));
  for (const version of versions) {
    const marker = fixtureMarker(version.description);
    const source = await readWorker(page, version.source_chat_session_id, true);
    expect(
      sources.has(source.id),
      "Each fixture worker makes exactly one owned save",
    ).toBe(false);
    sources.add(source.id);
    expect(Date.parse(source.created_at)).toBeLessThanOrEqual(
      Date.parse(version.created_at),
    );
    const entries = await readLedger(page, source.id);
    sourceLedgers.set(source.id, entries);
    const firstUser = entries.find((e) => e.message?.role === "user");
    expect(
      firstUser,
      "Historical creation prompt must be available",
    ).toBeDefined();
    expect(entryText(firstUser!)).toContain(MEMORY_KEY);
    expect(entryText(firstUser!)).toContain(version.description);
    expect(entryText(firstUser!)).toContain(version.content);
    const proof = saveProof(entries, version.description, version.content);
    expect(proof.memoryID).toBe(memory.id);
    expect(proof.result.log_seq).toBeGreaterThan(firstUser!.log_seq);
    expect(
      entries.filter(
        (entry) =>
          entry.message?.role === "user" &&
          entry.log_seq < proof.result.log_seq,
      ),
      "The save must belong to the recorded creation prompt, not a later unrelated request",
    ).toHaveLength(1);
    const group = groups.get(marker) ?? [];
    group.push(version);
    groups.set(marker, group);
  }
  for (const [marker, group] of groups) {
    expect(
      group.length,
      "No extra/foreign saves may hide behind a fixture marker",
    ).toBeLessThanOrEqual(2);
    expect(group[0].content).toBe(memoryContent(marker, INITIAL_LANGUAGE));
    if (group.length === 2) {
      expect(
        UPDATED_LANGUAGES.map((language) => memoryContent(marker, language)),
      ).toContain(group[1].content);
    }
  }
  const latest = versions.at(-1)!;
  expect(memory.content).toBe(latest.content);
  expect(memory.description).toBe(latest.description);
  const latestLedger = sourceLedgers.get(latest.source_chat_session_id)!;
  const deletionCalls = toolCalls(latestLedger).filter(
    (call) =>
      call.name === "delete_memory" && call.arguments.name === MEMORY_KEY,
  );
  expect(
    deletionCalls,
    "Owned historical tombstone needs an actual scoped runtime deletion",
  ).toHaveLength(1);
  const deletionResults = latestLedger.filter(
    (entry) =>
      entry.message?.role === "toolResult" &&
      entry.message.toolCallId === deletionCalls[0].id &&
      entry.message.toolName === "delete_memory" &&
      entry.message.isError === false,
  );
  expect(deletionResults).toHaveLength(1);
  expect(entryText(deletionResults[0])).toContain(
    `Deleted memory "${MEMORY_KEY}" (id ${memory.id})`,
  );
  const deletionAt = Date.parse(memory.deleted_at!);
  const resultAt = Date.parse(deletionResults[0].timestamp);
  expect(Number.isFinite(deletionAt)).toBe(true);
  expect(deletionAt).toBeGreaterThanOrEqual(Date.parse(latest.created_at));
  expect(resultAt).toBeGreaterThanOrEqual(deletionAt);
  // A conservative provenance gate, not a retry/wait: a changed tombstone date
  // cannot be silently attributed to an old fixture deletion.
  expect(
    resultAt - deletionAt,
    "Tombstone timestamp must corroborate its actual owned delete result",
  ).toBeLessThan(10000);
  return versions;
}

/** Never attach model thinking or unrelated project memory bodies. */
export function ledgerEvidence(entries: Entry[]) {
  return entries.map((entry) => {
    if (entry.customType === "system_prompt") {
      const content = entry.data?.content ?? "";
      const blocks = content.match(/<memory>[\s\S]*?<\/memory>/g) ?? [];
      return {
        id: entry.id,
        log_seq: entry.log_seq,
        type: entry.type,
        customType: entry.customType,
        sha256: createHash("sha256").update(content).digest("hex"),
        exactKeyOccurrences: content.split(MEMORY_KEY).length - 1,
        ownedIndexEntries: blocks.filter((block) =>
          block.includes(`<name>${MEMORY_KEY}</name>`),
        ),
      };
    }
    return {
      ...entry,
      message: entry.message && {
        ...entry.message,
        content: entry.message.content.filter(
          (c) => c.type !== "thinking" && c.type !== "reasoning",
        ),
      },
    };
  });
}
