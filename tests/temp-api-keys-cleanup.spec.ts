import { randomUUID } from "node:crypto";
import { test as base, expect } from "./fixtures";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import { navigateToSettings } from "./pages/settings";
import {
  API_KEY_MAINTENANCE_MIN_AGE_MS,
  ApiKeyRecord,
  createOwnedCleanupKey,
  deleteApiKeysInBatches,
  listApiKeysForCleanup,
  selectApiKeysForCleanup,
} from "./pages/api-key-cleanup";

const test = base.extend<{
  ownedCleanupKeys: { create: (name: string) => Promise<ApiKeyRecord> };
}>({
  ownedCleanupKeys: async ({ page }, use) => {
    const headers = await getApiWorkerAuthHeaders(page);
    const createdKeys: ApiKeyRecord[] = [];
    await use({
      create: async (name) => {
        const key = await createOwnedCleanupKey(page, headers, name);
        createdKeys.push(key);
        return key;
      },
    });
    // Clean only this test's IDs, including when a regression assertion fails.
    await deleteApiKeysInBatches(page, headers, createdKeys);
  },
});

test.describe("TEMP: API Keys Cleanup", () => {
  test("owned cleanup preserves fresh neighbouring scenario keys", async ({
    page,
    ownedCleanupKeys,
  }, testInfo) => {
    const headers = await getApiWorkerAuthHeaders(page);
    const suffix = randomUUID();
    const owned = await ownedCleanupKeys.create(`Test-API-Key-owned-${suffix}`);
    const neighbour = await ownedCleanupKeys.create(
      `Delete-Button-Disabled-Test-${suffix}`,
    );
    const apiKeys = await listApiKeysForCleanup(page, headers);
    const liveKeys = apiKeys.filter((key) =>
      [owned.id, neighbour.id].includes(key.id),
    );
    expect(liveKeys).toHaveLength(2);

    const staleBefore = Date.now() - API_KEY_MAINTENANCE_MIN_AGE_MS;
    expect(selectApiKeysForCleanup(liveKeys, { staleBefore })).toEqual([]);
    const targets = selectApiKeysForCleanup(apiKeys, { ownedIds: [owned.id] });
    expect(targets.map((key) => key.id)).toEqual([owned.id]);
    await deleteApiKeysInBatches(page, headers, targets);

    const remaining = await listApiKeysForCleanup(page, headers);
    expect(remaining.map((key) => key.id)).not.toContain(owned.id);
    expect(remaining).toContainEqual(
      expect.objectContaining({ id: neighbour.id, name: neighbour.name }),
    );
    await navigateToSettings(page, "API Keys");
    await expect(
      page.getByRole("row").filter({ hasText: owned.name }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("row").filter({ hasText: neighbour.name }),
    ).toBeVisible();
    const screenshotPath = testInfo.outputPath("cleanup-ownership-proof.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach("cleanup-ownership-proof", {
      path: screenshotPath,
      contentType: "image/png",
    });
  });

  test("cleanup accumulated test API keys", async ({ page }) => {
    // Explicit maintenance command, never a normal scheduled/full-suite sweep:
    // API_KEYS_MAINTENANCE=1 ENV_SLUG=preview npx playwright test
    //   tests/temp-api-keys-cleanup.spec.ts -g "cleanup accumulated"
    test.skip(
      process.env.API_KEYS_MAINTENANCE !== "1",
      "Accumulated-key maintenance is opt-in; owned cleanup runs normally.",
    );
    // Freeze the age fence once, for both selection and verification. Fresh
    // keys created by other workers/runs never become eligible during this run.
    const staleBefore = Date.now() - API_KEY_MAINTENANCE_MIN_AGE_MS;
    const headers = await getApiWorkerAuthHeaders(page);
    const apiKeys = await listApiKeysForCleanup(page, headers);
    const targets = selectApiKeysForCleanup(apiKeys, { staleBefore });
    await deleteApiKeysInBatches(page, headers, targets);

    const remaining = await listApiKeysForCleanup(page, headers);
    expect(selectApiKeysForCleanup(remaining, { staleBefore })).toEqual([]);
  });
});
