import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { test, expect } from "./fixtures";
import {
  cleanupMemoryWorkers,
  createMemoryWorker,
  expectMemoryTool,
  expectSavedMemory,
  finalAnswer,
  messageMemoryWorker,
  saveMemoryPrompt,
  type MemoryFixture,
} from "./pages/session-memory";

// Each parallel/repeated attempt owns a unique key; no shared preferences or
// historical tombstone audits. afterEach runs even when a scenario step fails.
let memory: MemoryFixture;
let timeline: unknown[];

test.beforeEach(() => {
  timeline = [];
  memory = {
    name: `e2e-memory-refresh-${randomUUID()}`,
    description: "Current token for an isolated worker memory-refresh fixture",
    workers: [],
  };
});

test.afterEach(async ({ page }, info) => {
  const cleanup = await cleanupMemoryWorkers(page, memory);
  const path = info.outputPath("memory-refresh.json");
  await writeFile(path, JSON.stringify({ timeline, cleanup }, null, 2));
  await info.attach("memory-refresh", {
    path,
    contentType: "application/json",
  });
  expect(
    cleanup.errors,
    "Memory deletion and every worker close succeed",
  ).toEqual([]);
});

test.describe("Worker Runtime", () => {
  test("refreshes an existing worker's project memory after another worker updates it", async ({
    page,
    context,
  }, info) => {
    test.setTimeout(240000);
    const original = await test.step("Worker A saves TOKEN_ALPHA", async () => {
      const created = await createMemoryWorker(
        page,
        memory,
        saveMemoryPrompt(memory, "TOKEN_ALPHA"),
      );
      const proof = await expectSavedMemory(
        created.worker,
        created.turn,
        memory,
        "TOKEN_ALPHA",
      );
      timeline.push({ stage: "initial-save", ...proof });
      expect(proof.version).toBe(1);
      return created.worker;
    });

    await test.step("Worker A consumes the original memory", async () => {
      const turn = await messageMemoryWorker(
        original,
        `Use read_memory to read ${memory.name}. Reply with only its current token.`,
      );
      expect(
        expectMemoryTool(turn, "read_memory", { name: memory.name }),
      ).toContain("The current token is TOKEN_ALPHA.");
      timeline.push({
        stage: "original-read",
        workerID: original.id,
        answer: finalAnswer(turn),
      });
      expect(finalAnswer(turn)).toBe("TOKEN_ALPHA");
    });

    await test.step("Worker B updates the same memory to TOKEN_BRAVO", async () => {
      const secondPage = await context.newPage();
      const updated = await createMemoryWorker(
        secondPage,
        memory,
        saveMemoryPrompt(memory, "TOKEN_BRAVO"),
      );
      const proof = await expectSavedMemory(
        updated.worker,
        updated.turn,
        memory,
        "TOKEN_BRAVO",
      );
      expect(proof.version).toBe(2);
      timeline.push({ stage: "updated-save", ...proof });
    });

    await test.step("The original worker answers with the updated token", async () => {
      // Neither discloses the new value nor instructs the worker to refresh.
      const turn = await messageMemoryWorker(
        original,
        `What is the current token for ${memory.name}? Reply with only the token.`,
      );
      timeline.push({
        stage: "refreshed-answer",
        workerID: original.id,
        answer: finalAnswer(turn),
        tools: turn
          .flatMap((entry) => entry.message?.content ?? [])
          .filter((part) => part.type === "toolCall"),
      });
      expect(finalAnswer(turn)).toBe("TOKEN_BRAVO");
      const path = info.outputPath("refreshed-memory.png");
      await page.screenshot({ path });
      await info.attach("refreshed-memory", { path, contentType: "image/png" });
    });
  });
});
