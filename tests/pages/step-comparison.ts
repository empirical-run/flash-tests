import { expect, Locator, Page } from "@playwright/test";

export function visualComparisonSection(page: Page): Locator {
  // Compare Steps shares the header row with the heading; the panels are below it.
  return page
    .getByRole("heading", { name: "Visual Comparison", exact: true })
    .locator("xpath=ancestor::div[.//video][1]");
}

/** Open the real comparison and tie its failure trace to the displayed run video. */
export async function openStepComparison(page: Page): Promise<Locator> {
  const section = visualComparisonSection(page);
  const video = section
    .getByText("This run", { exact: true })
    .locator("..")
    .locator("video");
  await expect(video).toHaveAttribute("src", /\/data\//);
  const videoUrl = (await video.getAttribute("src"))!;

  await section
    .getByRole("button", { name: "Compare Steps", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Step-by-Step Comparison",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const failureTrace = dialog.getByRole("link", {
    name: "Failure Trace",
    exact: true,
  });
  await expect(failureTrace).toHaveAttribute("href", /trace\.zip/);
  const traceUrl = new URL(
    (await failureTrace.getAttribute("href"))!,
  ).searchParams.get("trace");
  expect(traceUrl).toContain(`${videoUrl.split("/data/")[0]}/data/`);
  return dialog;
}

/** A rendered image, not just an empty/broken screenshot placeholder. */
export async function expectComparisonScreenshot(
  dialog: Locator,
  name: string,
): Promise<void> {
  const screenshot = dialog.getByRole("img", { name, exact: true });
  await expect(screenshot).toBeVisible();
  await expect
    .poll(
      () =>
        screenshot.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      {
        message: `Comparison screenshot failed to load: ${name}`,
        timeout: 30_000,
      },
    )
    .toBe(true);
}

/** The seeded search failure has no pass in the 30-day comparison window. */
export async function expectNoPassingRunComparison(page: Page): Promise<void> {
  const dialog = await openStepComparison(page);
  await expect(dialog.getByRole("alert")).toContainText(
    "No passing run to compare with",
    { timeout: 120_000 },
  );
  await expect(dialog.getByRole("alert")).toContainText(
    "This test has not passed in the last 30 days.",
  );
  await expect(
    dialog.getByRole("link", { name: "Pass Trace", exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByRole("figure")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Next step", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(visualComparisonSection(page)).toBeVisible();
}
