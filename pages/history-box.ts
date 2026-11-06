import { expect, Locator, Page } from "@playwright/test";

/** History boxes are buttons; their navigation link belongs to the controlled popover. */
export async function openHistoryBoxDetails(
  page: Page,
  box: Locator,
  options: {
    runId: number;
    testId: string;
    status: "Passed" | "Failed" | "Flaky";
  },
): Promise<{ openRun: Locator; target: URL }> {
  const { runId, testId, status } = options;
  expect(testId).toMatch(/^[a-f0-9]{20}-[a-f0-9]{20}$/);
  await expect(box).toHaveCount(1);
  await expect(box).toHaveAccessibleName(`Run #${runId}: ${status}`);
  await expect(box).toHaveAttribute("aria-haspopup", "dialog");
  await box.click();
  await expect(box).toHaveAttribute("aria-expanded", "true");
  const controls = await box.getAttribute("aria-controls");
  expect(controls).toBeTruthy();
  const details = page
    .getByRole("dialog")
    .and(page.locator(`[id="${controls}"]`));
  await expect(details).toBeVisible();
  await expect(
    details.getByText(`Run #${runId} · ${status}`, { exact: true }),
  ).toBeVisible();
  await expect(
    details.getByText(/\d{2}\/\d{2}\/\d{2}, \d{2}:\d{2}/),
  ).toBeVisible();
  const openRun = details.getByRole("link", { name: "Open run", exact: true });
  await expect(openRun).toBeVisible();
  await expect(openRun).toHaveAttribute("href", /\?test_id=/);
  const target = new URL((await openRun.getAttribute("href"))!, page.url());
  expect(target.pathname).toBe(`/lorem-ipsum/test-runs/${runId}`);
  expect(target.searchParams.get("test_id")).toBe(testId);
  expect(target.searchParams.has("pw_test_id")).toBe(false);
  return { openRun, target };
}
