/* global Set */
import { randomUUID, createHash } from "node:crypto";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { test as base } from "../fixtures";
import { getDashboardBaseUrl, getApiBaseUrl } from "./urls";
import {
  getNewSessionPromptInput,
  getSessionComposer,
  openNewSessionDialog,
  sendMessage,
  waitForAgentIdle,
} from "./sessions";
import {
  MEMORY_KEY,
  INITIAL_LANGUAGE,
  UPDATED_LANGUAGES,
  completedAssistant,
  entryText,
  ledgerEvidence,
  listMemories,
  memoryAuth,
  memoryContent,
  memoryDescription,
  proveHistoricalTombstone,
  readLedger,
  readVersions,
  readWorker,
  saveProof,
  toolCalls,
  type Entry,
  type Memory,
  type MemoryVersion,
  type SaveProof,
} from "./session-memory";

type OwnedSession = {
  page: Page;
  id: number;
  language: string;
  prompt: string;
  create: unknown;
  documentTimeOrigin: number;
  navigation: string[];
};
export type SavedWorker = OwnedSession & {
  proof: SaveProof;
  version: MemoryVersion;
};
export type WorkerMemoryScenario = {
  savePortuguese: () => Promise<SavedWorker>;
  saveDifferentLanguage: (first: SavedWorker) => Promise<SavedWorker>;
  askOriginal: (
    first: SavedWorker,
    second: SavedWorker,
  ) => Promise<{ answer: string; language: string }>;
};
type Baseline = { memory: Memory; versions: MemoryVersion[] };

async function attachEvidence(info: TestInfo, evidence: unknown[]) {
  await info.attach("worker-memory-provenance", {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: "application/json",
  });
}

function makeScenario(page: Page, info: TestInfo) {
  const marker = `flash-tests:worker-memory-refresh:${randomUUID()}`;
  const choice =
    createHash("sha256").update(marker).digest().readUInt32BE(0) %
    UPDATED_LANGUAGES.length;
  const language = UPDATED_LANGUAGES[choice];
  const description = memoryDescription(marker);
  const owned: OwnedSession[] = [];
  const saves: SavedWorker[] = [];
  const baseline: Baseline[] = [];
  const evidence: unknown[] = [
    {
      marker,
      key: MEMORY_KEY,
      language,
      languageSelection: "sha256(recorded fixture marker) modulo 3",
    },
  ];
  let memoryID: number | undefined;
  let originalQuestionCompleted = false;

  async function currentKey() {
    const listing = await listMemories(page, true);
    return {
      matches: listing.memories.filter((m) => m.name === MEMORY_KEY),
      pages: listing.pages,
    };
  }

  async function verifyBaselineUnchanged() {
    const current = await currentKey();
    expect(
      current.matches,
      "STOP: key changed between provenance validation and first create",
    ).toEqual(baseline.map((b) => b.memory));
    for (const old of baseline) {
      expect(
        await readVersions(page, old.memory.id),
        "STOP: historical tombstone revisions changed",
      ).toEqual(old.versions);
    }
    return current;
  }

  async function waitForTurn(
    worker: OwnedSession,
    cutoff: number,
  ): Promise<Entry[]> {
    let entries: Entry[] = [];
    await expect
      .poll(
        async () => {
          entries = await readLedger(worker.page, worker.id);
          return completedAssistant(entries, cutoff)?.id;
        },
        {
          timeout: 120000,
          message: `Worker ${worker.id} must finish its actual turn`,
        },
      )
      .toBeDefined();
    await waitForAgentIdle(worker.page, 120000);
    await expect(getSessionComposer(worker.page)).toBeEnabled();
    const metadata = await readWorker(worker.page, worker.id, false);
    expect(
      metadata.chat_state?.error,
      "Healthy idle worker required",
    ).toBeFalsy();
    return entries;
  }

  async function createWorker(
    workerPage: Page,
    nextLanguage: string,
    first: boolean,
  ) {
    expect(
      owned.length,
      "This scenario may create only two workers",
    ).toBeLessThan(2);
    await workerPage.goto(`${getDashboardBaseUrl()}/sessions`);
    await openNewSessionDialog(workerPage);
    const action = first ? "save" : "update";
    const content = memoryContent(marker, nextLanguage);
    const prompt = `Use save_memory to ${action} a project memory named exactly ${MEMORY_KEY}. Description: ${description}. Content: ${content} Save only this memory using the real tool, then stop.`;
    await getNewSessionPromptInput(workerPage).fill(prompt);
    // Immediately pre-create: fail on unknown records. This is NOT atomic CAS:
    // no reservation API is known. Concurrent callers of this exact-key fixture
    // need separate review/coordination; serializing unrelated tests hides races.
    const guard = first
      ? await verifyBaselineUnchanged()
      : await verifyCurrentOwnership();
    evidence.push({
      stage: "pre-create",
      first,
      at: new Date().toISOString(),
      guard,
    });
    const navigation: string[] = [];
    workerPage.on("framenavigated", (frame) => {
      if (frame === workerPage.mainFrame()) navigation.push(frame.url());
    });
    const routePattern = "**/api/chat-sessions";
    let requestBody: unknown;
    await workerPage.route(routePattern, async (route, request) => {
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }
      requestBody = { ...request.postDataJSON(), mode: "worker" };
      await route.continue({ postData: JSON.stringify(requestBody) });
    });
    const creation = workerPage.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/chat-sessions" &&
        response.request().method() === "POST",
    );
    // The live dialog adds an Enter-key glyph to the name; do not click the
    // underlying list's separate Create button or fabricate a response.
    await workerPage
      .getByRole("dialog")
      .getByRole("button", { name: /^Create\b/ })
      .click();
    const response = await creation;
    const body = await response.json();
    evidence.push({
      stage: "create-response",
      status: response.status(),
      requestBody,
      body,
    });
    expect(response.status()).toBe(201);
    const created = body.data.chat_session;
    expect(created).toMatchObject({
      project_id: 3,
      mode: "worker",
      is_closed: false,
    });
    expect(created.id).toBeGreaterThan(0);
    expect(owned.some((worker) => worker.id === created.id)).toBe(false);
    // Register immediately from the completed create response, before later UI
    // assertions. Our fixture, not fixtures.ts's cached afterEach, owns teardown.
    const worker: OwnedSession = {
      page: workerPage,
      id: created.id,
      language: nextLanguage,
      prompt,
      create: {
        status: response.status(),
        id: created.id,
        project_id: created.project_id,
        mode: created.mode,
        requestBody,
      },
      documentTimeOrigin: await workerPage.evaluate(
        () => performance.timeOrigin,
      ),
      navigation,
    };
    owned.push(worker);
    info.annotations.push({
      type: "Owned worker session",
      description: `${getDashboardBaseUrl()}/sessions/${worker.id}`,
    });
    await workerPage.waitForURL(
      `${getDashboardBaseUrl()}/sessions/${worker.id}`,
    );
    await workerPage.unroute(routePattern);
    await readWorker(workerPage, worker.id, false);
    const entries = await waitForTurn(worker, 0);
    evidence.push({
      stage: "save-turn",
      id: worker.id,
      ledger: ledgerEvidence(entries),
    });
    const proof = saveProof(entries, description, content);
    if (first) memoryID = proof.memoryID;
    expect(
      proof.memoryID,
      "Both saves must target the same memory identity",
    ).toBe(memoryID);
    // After actual completion, establish the observed persistence result. Do not
    // assume how save_memory restores a positively-owned soft-deleted name.
    const persisted = await currentKey();
    const active = persisted.matches.filter((m) => m.deleted_at === null);
    expect(
      active,
      "One unambiguous active owned memory is required",
    ).toHaveLength(1);
    expect(active[0]).toMatchObject({
      id: memoryID,
      project_id: 3,
      name: MEMORY_KEY,
      description,
      content,
    });
    const versions = await readVersions(page, memoryID!);
    const historical =
      baseline.find((b) => b.memory.id === memoryID)?.versions ?? [];
    const prior = [...historical, ...saves.map((save) => save.version)];
    expect(
      versions.slice(0, -1),
      "No historical revision may disappear or change on reuse",
    ).toEqual(prior);
    const version = versions.at(-1)!;
    expect(version).toMatchObject({
      memory_id: memoryID,
      name: MEMORY_KEY,
      description,
      content,
      source_chat_session_id: worker.id,
    });
    expect(version.version).toBe((prior.at(-1)?.version ?? 0) + 1);
    const saved: SavedWorker = { ...worker, proof, version };
    saves.push(saved);
    await verifyCurrentOwnership();
    evidence.push({
      stage: "persisted-save",
      id: worker.id,
      proof,
      memory: active[0],
      versions,
      tombstoneOutcome: first
        ? historical.length
          ? "same-ID reactivation observed"
          : "new active ID observed"
        : undefined,
    });
    return saved;
  }

  async function verifyCurrentOwnership() {
    expect(
      memoryID,
      "No deletion/write without a completed tool identity",
    ).toBeDefined();
    expect(saves.length).toBeGreaterThan(0);
    const current = await currentKey();
    const active = current.matches.filter((m) => m.deleted_at === null);
    expect(
      active,
      "STOP: ambiguous/foreign active exact-key memory",
    ).toHaveLength(1);
    const latestSave = saves.at(-1)!;
    expect(active[0]).toMatchObject({
      id: memoryID,
      project_id: 3,
      name: MEMORY_KEY,
      description,
      content: memoryContent(marker, latestSave.language),
    });
    const historical =
      baseline.find((b) => b.memory.id === memoryID)?.versions ?? [];
    const versions = await readVersions(page, memoryID!);
    expect(
      versions,
      "STOP: additional/foreign revisions; preserve fixtures",
    ).toEqual([...historical, ...saves.map((save) => save.version)]);
    const permittedIDs = new Set([
      ...baseline.map((b) => b.memory.id),
      memoryID!,
    ]);
    expect(
      current.matches.every((m) => permittedIDs.has(m.id)),
      "STOP: unknown same-name record appeared",
    ).toBe(true);
    for (const old of baseline.filter((b) => b.memory.id !== memoryID)) {
      expect(current.matches.find((m) => m.id === old.memory.id)).toEqual(
        old.memory,
      );
      expect(await readVersions(page, old.memory.id)).toEqual(old.versions);
    }
    return { memory: active[0], versions, pages: current.pages };
  }

  const scenario: WorkerMemoryScenario = {
    savePortuguese: async () => {
      expect(owned).toHaveLength(0);
      const { headers } = await memoryAuth(page);
      const projectResponse = await page.request.get(
        `${getApiBaseUrl()}/api/projects/3`,
        { headers },
      );
      expect(projectResponse.status()).toBe(200);
      expect((await projectResponse.json()).data).toMatchObject({
        id: 3,
        slug: "lorem-ipsum",
      });
      const before = await currentKey();
      evidence.push({
        stage: "preflight",
        at: new Date().toISOString(),
        matches: before.matches,
        pages: before.pages,
      });
      for (const memory of before.matches) {
        // Unknown active records and unknown tombstones fail before creation.
        baseline.push({
          memory,
          versions: await proveHistoricalTombstone(page, memory),
        });
      }
      return createWorker(page, INITIAL_LANGUAGE, true);
    },
    saveDifferentLanguage: async (first) => {
      expect(saves).toHaveLength(1);
      expect(first.id).toBe(owned[0].id);
      const secondPage = await page.context().newPage();
      return createWorker(secondPage, language, false);
    },
    askOriginal: async (first, second) => {
      expect(saves).toHaveLength(2);
      expect([first.id, second.id]).toEqual(owned.map((worker) => worker.id));
      await verifyCurrentOwnership();
      await first.page.bringToFront(); // Return to the original document, not goto/reload.
      expect(first.page.url()).toBe(
        `${getDashboardBaseUrl()}/sessions/${first.id}`,
      );
      expect(await first.page.evaluate(() => performance.timeOrigin)).toBe(
        first.documentTimeOrigin,
      );
      expect(first.navigation).toEqual([
        `${getDashboardBaseUrl()}/sessions/${first.id}`,
      ]);
      const before = await readLedger(first.page, first.id);
      expect(before.filter((e) => e.message?.role === "user")).toHaveLength(1);
      expect(
        completedAssistant(before, first.proof.result.log_seq),
      ).toBeDefined();
      const cutoff = Math.max(...before.map((e) => e.log_seq));
      const question = "What's Arjun's preferred language?";
      evidence.push({
        stage: "question-cutoff",
        at: new Date().toISOString(),
        id: first.id,
        cutoff,
        documentTimeOrigin: first.documentTimeOrigin,
        navigation: [...first.navigation],
        question,
      });
      await sendMessage(first.page, question);
      const after = await waitForTurn(first, cutoff);
      expect(after.filter((e) => e.message?.role === "user")).toHaveLength(2);
      const tail = after.filter((e) => e.log_seq > cutoff);
      const final = completedAssistant(after, cutoff)!;
      const answer = entryText(final);
      const calls = toolCalls(tail);
      evidence.push({
        stage: "final-answer",
        at: new Date().toISOString(),
        id: first.id,
        cutoff: { log_seq: final.log_seq, id: final.id },
        answer,
        calls,
        explicitFetchObserved: calls.some((c) => c.name === "read_memory"),
        proofBoundary:
          "Tool calls are recorded, not forbidden. Updated recall with a fetch is not independent proof of automatic refresh.",
        ledger: ledgerEvidence(tail),
      });
      expect(await first.page.evaluate(() => performance.timeOrigin)).toBe(
        first.documentTimeOrigin,
      );
      expect(first.navigation).toEqual([
        `${getDashboardBaseUrl()}/sessions/${first.id}`,
      ]);
      const questionItem = first.page
        .locator('[data-slot="message-scroller-item"]')
        .filter({
          has: first.page
            .locator('[data-slot="message"][data-align="end"]')
            .getByText(question, { exact: true }),
        });
      await expect(questionItem).toHaveCount(1);
      const reply = questionItem
        .locator(
          'xpath=following-sibling::*[@data-slot="message-scroller-item"]',
        )
        .locator('[data-slot="message"][data-align="start"]')
        .filter({
          hasText: new RegExp(
            `^${answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          ),
        });
      await expect(reply).toHaveCount(1);
      await expect(reply).toHaveText(answer);
      await info.attach("original-worker-final-answer", {
        body: await first.page.screenshot(),
        contentType: "image/png",
      });
      originalQuestionCompleted = true;
      return { answer, language: second.language };
    },
  };

  async function closeOwnedWorkers() {
    // Teardown-only isolation: one failed close must not prevent attempting the
    // other response-owned worker. Errors remain fatal, never warnings/skips.
    const errors: { id: number; error: string }[] = [];
    for (const worker of [...owned].reverse()) {
      try {
        await waitForTurn(worker, 0);
        const guard = await readWorker(worker.page, worker.id, false);
        const { headers } = await memoryAuth(worker.page);
        const response = await worker.page.request.post(
          `${getApiBaseUrl()}/api/chat-sessions/${worker.id}/close`,
          { headers },
        );
        evidence.push({
          stage: "close",
          id: worker.id,
          guard,
          status: response.status(),
        });
        expect(response.status()).toBe(200);
        await expect
          .poll(
            async () => {
              const readback = await worker.page.request.get(
                `${getApiBaseUrl()}/api/chat-sessions/${worker.id}`,
                { headers },
              );
              expect(readback.status()).toBe(200);
              const actual = (await readback.json()).data.chat_session;
              expect(actual).toMatchObject({
                id: worker.id,
                project_id: 3,
                mode: "worker",
              });
              evidence.push({
                stage: "closed-readback",
                id: worker.id,
                status: readback.status(),
                is_closed: actual.is_closed,
              });
              return actual.is_closed;
            },
            { message: `Exact owned worker ${worker.id} must be closed` },
          )
          .toBe(true);
      } catch (error) {
        errors.push({
          id: worker.id,
          error: String(error).replace(/Bearer\s+\S+/g, "Bearer [redacted]"),
        });
      }
    }
    evidence.push({ stage: "close-errors", errors });
    expect(
      errors,
      "Every eligible owned worker must have a verified close; cleanup errors are fatal",
    ).toEqual([]);
  }

  async function cleanup() {
    if (!owned.length) return; // A failed read-only preflight has nothing to mutate.
    if (!saves.length) {
      // Failed creation/save may only be closed when no memory mutation occurred.
      // Ambiguous persistence is preserved and surfaced, never arbitrarily deleted.
      await verifyBaselineUnchanged();
      await closeOwnedWorkers();
      return;
    }
    const guard = await verifyCurrentOwnership();
    const worker = saves.at(-1)!;
    const before = await waitForTurn(worker, 0);
    const cutoff = Math.max(...before.map((e) => e.log_seq));
    evidence.push({
      stage: "deletion-guard",
      at: new Date().toISOString(),
      originalQuestionCompleted,
      guard,
    });
    await sendMessage(
      worker.page,
      `Use your delete_memory tool to delete only the project memory named exactly ${MEMORY_KEY}, memory ID ${memoryID}. It is the ${marker} fixture; its latest owned version is ${worker.version.version}. Do not modify any other memory. If delete_memory is unavailable or cannot safely delete this exact owned memory, report the blocker and do not use an API, shell, or other fallback. After the tool finishes, stop.`,
    );
    const entries = await waitForTurn(worker, cutoff);
    const tail = entries.filter((e) => e.log_seq > cutoff);
    evidence.push({ stage: "deletion-turn", ledger: ledgerEvidence(tail) });
    const calls = toolCalls(tail);
    expect(
      calls,
      "Only the supported owned deletion tool may run; preserve fixtures if unsupported",
    ).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: "delete_memory",
      arguments: { name: MEMORY_KEY },
    });
    const results = tail.filter(
      (e) =>
        e.message?.role === "toolResult" &&
        e.message.toolCallId === calls[0].id,
    );
    expect(results).toHaveLength(1);
    expect(results[0].message).toMatchObject({
      toolName: "delete_memory",
      isError: false,
    });
    expect(entryText(results[0])).toContain(
      `Deleted memory "${MEMORY_KEY}" (id ${memoryID})`,
    );
    const all = await currentKey();
    const tombstone = all.matches.find((m) => m.id === memoryID);
    expect(tombstone).toMatchObject({
      id: memoryID,
      project_id: 3,
      name: MEMORY_KEY,
      description,
      content: worker.version.content,
    });
    expect(tombstone!.deleted_at).toEqual(expect.any(String));
    expect(await readVersions(page, memoryID!)).toEqual(guard.versions);
    const active = await listMemories(page, false);
    expect(
      active.memories.some((m) => m.id === memoryID || m.name === MEMORY_KEY),
    ).toBe(false);
    evidence.push({
      stage: "deleted-readback",
      at: new Date().toISOString(),
      tombstone,
      includeDeletedPages: all.pages,
      activePages: active.pages,
      activeCount: active.memories.length,
      exactIDAndKeyAbsent: true,
      versions: guard.versions,
    });
    await closeOwnedWorkers();
  }
  return { scenario, cleanup, evidence };
}

export const workerMemoryTest = base.extend<{
  workerMemory: WorkerMemoryScenario;
}>({
  workerMemory: async ({ page }, use, info) => {
    const fixture = makeScenario(page, info);
    await use(fixture.scenario);
    // Playwright resumes fixture teardown on assertion failures too. Keep the
    // page/context alive through memory cleanup and fresh close readbacks.
    try {
      await fixture.cleanup();
    } finally {
      await attachEvidence(info, fixture.evidence);
    }
  },
});
