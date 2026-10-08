import { test, expect } from "@playwright/test";
import {
  API_KEY_MAINTENANCE_MIN_AGE_MS,
  ApiKeyRecord,
  selectApiKeysForCleanup,
} from "./pages/api-key-cleanup";

const now = Date.parse("2026-10-08T03:00:00Z");
const staleBefore = now - API_KEY_MAINTENANCE_MIN_AGE_MS;
const key: ApiKeyRecord = {
  id: 1,
  name: "Delete-Button-Disabled-Test-fixture",
  created_at: new Date(staleBefore - 1).toISOString(),
};

test.describe("API key cleanup policy", () => {
  test("defaults to no shared deletion and selects only explicit owned IDs", () => {
    expect(selectApiKeysForCleanup([key], {})).toEqual([]);
    expect(selectApiKeysForCleanup([key], { ownedIds: [2] })).toEqual([]);
    expect(selectApiKeysForCleanup([key], { ownedIds: [1] })).toEqual([key]);
  });

  test("stale maintenance retains all fresh scenario prefixes", () => {
    const keys = [
      "Delete-Button-Disabled-Test-",
      "Delete-Confirmation-Test-",
      "Cancel-Disable-Test-Key-",
      "Cancel-Enable-Test-Key-",
    ].map((prefix, id) => ({
      ...key,
      id,
      name: `${prefix}live`,
      created_at: new Date(now).toISOString(),
    }));
    expect(selectApiKeysForCleanup(keys, { staleBefore })).toEqual([]);
  });

  test("selects stale known test keys at the fixed cutoff, not newer keys", () => {
    const atCutoff = {
      ...key,
      id: 2,
      created_at: new Date(staleBefore).toISOString(),
    };
    const newer = {
      ...key,
      id: 3,
      created_at: new Date(staleBefore + 1).toISOString(),
    };
    expect(
      selectApiKeysForCleanup([key, atCutoff, newer], { staleBefore }),
    ).toEqual([key, atCutoff]);
  });

  test("invalid, missing and future timestamps never authorize maintenance", () => {
    const keys = ["not-a-date", "", new Date(now + 1000).toISOString()].map(
      (created_at, id) => ({ ...key, id, created_at }),
    );
    expect(selectApiKeysForCleanup(keys, { staleBefore })).toEqual([]);
  });

  test("preserves internal keys even when owned or stale, and unrelated names", () => {
    const internal = { ...key, is_internal: true };
    const unrelated = { ...key, id: 2, name: "Customer production key" };
    expect(
      selectApiKeysForCleanup([internal, unrelated], {
        staleBefore,
        ownedIds: [1],
      }),
    ).toEqual([]);
  });

  test("reuses the same cutoff when new keys arrive after the first snapshot", () => {
    const arriving = {
      ...key,
      id: 2,
      created_at: new Date(now + 1000).toISOString(),
    };
    expect(selectApiKeysForCleanup([key], { staleBefore })).toEqual([key]);
    expect(selectApiKeysForCleanup([arriving], { staleBefore })).toEqual([]);
  });
});
