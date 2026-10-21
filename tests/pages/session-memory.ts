import { expect, type Page } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";
import { getSessionComposer, sendMessage, waitForAgentIdle } from "./sessions";

export type Worker = { id: number; page: Page };
export type MemoryFixture = {
  name: string;
  description: string;
  workers: Worker[];
  memoryID?: number;
};
type Entry = {
  id: string;
  log_seq: number;
  message?: {
    role: string;
    stopReason?: string;
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
    content: {
      type: string;
      text?: string;
      id?: string;
      name?: string;
      arguments?: Record<string, string>;
    }[];
  };
};
type Memory = {
  id: number;
  project_id: number;
  name: string;
  description: string;
  content: string;
  deleted_at: string | null;
};

async function api(page: Page, path: string, data?: unknown) {
  const headers = await getApiWorkerAuthHeaders(page);
  const url = `${getApiBaseUrl()}${path}`;
  const response =
    data === undefined
      ? await page.request.get(url, { headers })
      : await page.request.post(url, { headers, data });
  expect(response.ok(), `${path}: HTTP ${response.status()}`).toBe(true);
  return response.json();
}

export function entryText(entry: Entry) {
  return (entry.message?.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
}

async function readLedger(worker: Worker): Promise<Entry[]> {
  const entries: Entry[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page++) {
    const body = await api(
      worker.page,
      `/api/chat-sessions/${worker.id}/session-state?page=${page}&per_page=100`,
    );
    totalPages = body.pagination.total_pages;
    entries.push(...body.data.entries);
  }
  return entries.sort((a, b) => a.log_seq - b.log_seq);
}

/** Completion is a terminal event, not a requirement for non-empty prose. */
async function waitForTurn(worker: Worker, prompt: string, cutoff = 0) {
  let turn: Entry[] = [];
  await expect
    .poll(
      async () => {
        const entries = await readLedger(worker);
        const user = entries.find(
          (entry) =>
            entry.log_seq > cutoff &&
            entry.message?.role === "user" &&
            entryText(entry).endsWith(prompt),
        );
        turn = entries.filter(
          (entry) => entry.log_seq > (user?.log_seq ?? Infinity),
        );
        return turn.some(
          (entry) =>
            entry.message?.role === "assistant" &&
            entry.message.stopReason === "stop",
        );
      },
      {
        timeout: 120000,
        message: `Worker ${worker.id} finishes the requested turn`,
      },
    )
    .toBe(true);
  await waitForAgentIdle(worker.page, 30000);
  await expect(getSessionComposer(worker.page)).toBeEnabled();
  // The persisted readiness flag is top-level; successful completion is
  // verified by the assistant's terminal stop event above, not legacy chat_state.
  await expect
    .poll(
      async () => {
        const body = await api(worker.page, `/api/chat-sessions/${worker.id}`);
        return body.data.chat_session.ask_user_for_input;
      },
      { timeout: 30000, message: `Worker ${worker.id} is ready for input` },
    )
    .toBe(true);
  return turn;
}

/** API setup avoids testing the unrelated new-session dialog in this scenario. */
export async function createMemoryWorker(
  page: Page,
  fixture: MemoryFixture,
  prompt: string,
) {
  const body = await api(page, "/api/chat-sessions", {
    message: prompt,
    model: null,
    source: "dashboard",
    mode: "worker",
  });
  const worker = { id: body.data.chat_session.id as number, page };
  // Register before navigation or scenario assertions can fail.
  fixture.workers.push(worker);
  expect(body.data.chat_session).toMatchObject({
    mode: "worker",
    is_closed: false,
    project_id: Number(process.env.LOREM_IPSUM_PROJECT_ID),
  });
  await page.goto(`/sessions/${worker.id}`);
  const turn = await waitForTurn(worker, prompt);
  return { worker, turn };
}

export async function messageMemoryWorker(worker: Worker, prompt: string) {
  const before = await readLedger(worker);
  const cutoff = Math.max(0, ...before.map((entry) => entry.log_seq));
  await sendMessage(worker.page, prompt);
  return waitForTurn(worker, prompt, cutoff);
}

export function expectMemoryTool(
  turn: Entry[],
  name: string,
  args: Record<string, string>,
) {
  const calls = turn
    .flatMap((entry) => entry.message?.content ?? [])
    .filter((part) => part.type === "toolCall");
  expect(calls, `One ${name} call in this turn`).toHaveLength(1);
  expect(calls[0]).toMatchObject({ name, arguments: args });
  const results = turn.filter(
    (entry) =>
      entry.message?.role === "toolResult" &&
      entry.message.toolCallId === calls[0].id,
  );
  expect(results).toHaveLength(1);
  expect(results[0].message).toMatchObject({ toolName: name, isError: false });
  return entryText(results[0]);
}

export function finalAnswer(turn: Entry[]) {
  const answer = turn
    .filter(
      (entry) =>
        entry.message?.role === "assistant" &&
        entry.message.stopReason === "stop",
    )
    .at(-1);
  expect(answer, "A completed answer from this turn").toBeDefined();
  return entryText(answer!).trim();
}

export function saveMemoryPrompt(fixture: MemoryFixture, token: string) {
  return (
    `Use save_memory with exactly these JSON arguments: ${JSON.stringify({
      name: fixture.name,
      description: fixture.description,
      content: `The current token is ${token}.`,
    })}. ` + "Use only the real save_memory tool, then stop."
  );
}

export async function expectSavedMemory(
  worker: Worker,
  turn: Entry[],
  fixture: MemoryFixture,
  token: string,
) {
  const content = `The current token is ${token}.`;
  const result = expectMemoryTool(turn, "save_memory", {
    name: fixture.name,
    description: fixture.description,
    content,
  });
  const match = result.match(
    /^(?:Saved|Updated) memory "([^"]+)" \(id (\d+)\)/,
  );
  expect(match, "Save result identifies the persisted memory").not.toBeNull();
  expect(match![1]).toBe(fixture.name);
  const id = Number(match![2]);
  if (fixture.memoryID !== undefined) expect(id).toBe(fixture.memoryID);
  fixture.memoryID = id;
  const body = await api(worker.page, `/api/memories/${id}`);
  expect(body.data.memory).toMatchObject({
    id,
    name: fixture.name,
    description: fixture.description,
    content,
    deleted_at: null,
  });
  const versions = await api(worker.page, `/api/memories/${id}/versions`);
  const latest = versions.data.versions.reduce(
    (a: { version: number }, b: { version: number }) =>
      a.version > b.version ? a : b,
  );
  expect(latest).toMatchObject({ content, source_chat_session_id: worker.id });
  return { memoryID: id, version: latest.version, workerID: worker.id, token };
}

async function findOwnedMemory(
  page: Page,
  fixture: MemoryFixture,
  includeDeleted = false,
): Promise<Memory | undefined> {
  // Also finds a save that succeeded before the scenario could record its ID.
  let totalPages = 1;
  for (let n = 1; n <= totalPages; n++) {
    const body = await api(
      page,
      `/api/memories?page=${n}&per_page=100${includeDeleted ? "&include_deleted=true" : ""}`,
    );
    totalPages = body.pagination.total_pages;
    const memory = body.data.memories.find(
      (m: Memory) => m.name === fixture.name,
    );
    if (memory) return memory;
  }
}

async function deleteOwnedMemory(page: Page, fixture: MemoryFixture) {
  if (!fixture.workers.length) return;
  const memory = await findOwnedMemory(page, fixture);
  if (!memory) return;
  expect(memory).toMatchObject({
    name: fixture.name,
    project_id: Number(process.env.LOREM_IPSUM_PROJECT_ID),
  });
  const versions = await api(page, `/api/memories/${memory.id}/versions`);
  expect(
    versions.data.versions.every(
      (version: { source_chat_session_id: number }) =>
        fixture.workers.some(
          (worker) => worker.id === version.source_chat_session_id,
        ),
    ),
    "Only this attempt's workers may have written the memory",
  ).toBe(true);
  const worker = fixture.workers.at(-1)!;
  const turn = await messageMemoryWorker(
    worker,
    `Use delete_memory to delete only the project memory named exactly ${fixture.name}, ` +
      `ID ${memory.id}. Use no other tools. After deletion, stop.`,
  );
  expect(
    expectMemoryTool(turn, "delete_memory", { name: fixture.name }),
  ).toContain(`Deleted memory "${fixture.name}" (id ${memory.id})`);
  const deleted = await findOwnedMemory(page, fixture, true);
  expect(deleted).toMatchObject({
    id: memory.id,
    deleted_at: expect.any(String),
  });
  expect(await findOwnedMemory(page, fixture)).toBeUndefined();
}

async function closeMemoryWorker(worker: Worker) {
  // Close is independent of answer text and memory-deletion success.
  await api(worker.page, `/api/chat-sessions/${worker.id}/close`, {});
  await expect
    .poll(
      async () => {
        const body = await api(worker.page, `/api/chat-sessions/${worker.id}`);
        return body.data.chat_session.is_closed;
      },
      { message: `Worker ${worker.id} is closed` },
    )
    .toBe(true);
  return worker.id;
}

/** Teardown-only error isolation: always attempt every owned close. */
export async function cleanupMemoryWorkers(page: Page, fixture: MemoryFixture) {
  const deletion = await Promise.allSettled([deleteOwnedMemory(page, fixture)]);
  const closes = await Promise.allSettled(
    fixture.workers.map(closeMemoryWorker),
  );
  const outcomes = [...deletion, ...closes];
  const errors = outcomes
    .filter((result) => result.status === "rejected")
    .map((result) => String(result.reason));
  return {
    memoryName: fixture.name,
    deleted: deletion[0].status === "fulfilled",
    closedWorkerIDs: closes
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value),
    errors,
  };
}
