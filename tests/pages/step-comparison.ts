import { expect, Locator, Page } from "@playwright/test";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";

/** The seeded search failure has no pass in the 30-day comparison window. */
export async function expectNoPassingRunComparison(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Compare", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "Compare", exact: true });
  await expect(panel.getByRole("alert")).toContainText(
    "Nothing to compare with",
    { timeout: 120_000 },
  );
  await expect(panel.getByRole("alert")).toContainText(
    "This test has not passed in the last 30 days, and no other attempt in this run has a trace.",
  );
  await expect(panel.getByRole("combobox")).toHaveText("None");
  await expect(panel.getByRole("figure")).toHaveCount(0);
  await expect(
    panel.getByRole("link", { name: "Open trace", exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Next step", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /^First run\b/ }).click();
}

/** Query order and preserved filters must not change run/test identity. */
export async function expectTestRunCaseIdentity(
  page: Page,
  runId: number,
  testId: string,
): Promise<void> {
  expect(testId).toBeTruthy();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `/lorem-ipsum/test-runs/${runId}` &&
      url.searchParams.get("test_id") === testId,
  );
}

/** A run-level Passed badge is not proof that this selected test passed. */
export async function expectPassingTestResult(
  page: Page,
  testName: string,
): Promise<Locator> {
  const detail = page.locator("#inner-sidebar-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByText(testName, { exact: true })).toBeVisible();
  await expect(detail.getByText("Passed", { exact: true })).toBeVisible();
  return detail;
}

/** Open the first attempt's real video attachments on the new report UI. */
export async function openCurrentAttempt(page: Page): Promise<Locator> {
  await expect(
    page.getByRole("tab", { name: "Compare", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /^First run\b/ }).click();
  const panel = page.getByRole("tabpanel", { name: /^First run\b/ });
  await expect(panel).toBeVisible();
  return panel;
}

export function attachmentVideo(section: Locator, name: string): Locator {
  return section
    .getByRole("heading", { name: `video: ${name}`, exact: true })
    .locator("xpath=ancestor::div[.//video][1]")
    .locator("video");
}

export async function expectLoadedVideo(video: Locator): Promise<string> {
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("src", /\/data\//);
  await expect
    .poll(
      () =>
        video.evaluate(
          (v: HTMLVideoElement) => v.readyState >= 2 && v.videoWidth > 0,
        ),
      { message: "Video must load real frames" },
    )
    .toBe(true);
  return (await video.getAttribute("src"))!;
}

/** Same run/test on every tab; no navigation to a different fixture. */
export async function verifySearchVideosAndComparison(
  page: Page,
): Promise<void> {
  const identity = new URL(page.url());
  const section = await openCurrentAttempt(page);
  await expect(section.locator("video")).toHaveCount(2);
  const defaultVideo = attachmentVideo(section, "video-0");
  const searchVideo = attachmentVideo(section, "search-page");
  const defaultUrl = await expectLoadedVideo(defaultVideo);
  const searchUrl = await expectLoadedVideo(searchVideo);
  expect(defaultUrl).toMatch(/video-video-0/);
  expect(searchUrl).toMatch(/video-search-page/);
  expect(searchUrl.split("/attachments/")[0]).toBe(
    defaultUrl.split("/attachments/")[0],
  );
  // Both labelled players now coexist instead of switching video tabs.
  await defaultVideo
    .locator("xpath=ancestor::*[@role='region'][1]")
    .getByRole("button", { name: "play", exact: true })
    .click();
  await expect
    .poll(() => defaultVideo.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  await searchVideo
    .locator("xpath=ancestor::*[@role='region'][1]")
    .getByRole("button", { name: "play", exact: true })
    .click();
  await expect
    .poll(() => searchVideo.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  await expectNoPassingRunComparison(page);
  await expect(defaultVideo).toHaveAttribute("src", defaultUrl);
  await expect(searchVideo).toHaveAttribute("src", searchUrl);
  expect(new URL(page.url()).pathname).toBe(identity.pathname);
  expect(new URL(page.url()).searchParams.get("test_id")).toBe(
    identity.searchParams.get("test_id"),
  );
}

export async function verifyLastSuccessfulRun(
  page: Page,
  testRunId: number,
): Promise<void> {
  const currentTestId = new URL(page.url()).searchParams.get("test_id")!;
  const currentPanel = await openCurrentAttempt(page);
  await expect(currentPanel.locator("video")).toHaveCount(1);
  const currentVideoUrl = await expectLoadedVideo(
    attachmentVideo(currentPanel, "video-0"),
  );
  const currentTraceLink = page.getByRole("link", {
    name: "View trace",
    exact: true,
  });
  await expect(currentTraceLink).toHaveAttribute("href", /trace\.zip/);
  const currentTraceUrl = new URL(
    (await currentTraceLink.getAttribute("href"))!,
  ).searchParams.get("trace")!;
  expect(currentVideoUrl.split("/attachments/")[0]).toBe(
    currentTraceUrl.replace(/\/trace\.zip.*$/, ""),
  );

  // The attempt action belongs to the report's tab row, not its attachments
  // panel. Keep it scoped to this selected test's detail (also works when the
  // same new-Compare action is inside the attempt panel on production).
  await page
    .locator("#inner-sidebar-detail")
    .getByRole("button", { name: "Compare this attempt", exact: true })
    .click();
  const comparison = page.getByRole("tabpanel", {
    name: "Compare",
    exact: true,
  });
  await expect(comparison).toBeVisible();
  // Compare is the default tab; the app deliberately omits its URL parameter.
  await expect(
    page.getByRole("tab", { name: "Compare", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(new URL(page.url()).searchParams.get("b")).toBe("retry-0");
  const baseline = comparison.getByRole("combobox");
  await expect(baseline).toHaveText(/.+· #\d+ ·/);
  const optionText = (await baseline.innerText()).trim();
  const historicalRunId = optionText.match(/#(\d+)/)![1];
  expect(Number(historicalRunId)).not.toBe(testRunId);
  await baseline.click();
  await page
    .getByRole("option", { name: new RegExp(`#${historicalRunId}\\b`) })
    .click();
  // Clicking the already-selected baseline does not emit onValueChange or set
  // `a`; the selected run and its trace/history artifacts are authoritative.
  await expect(baseline).toContainText(`#${historicalRunId}`);
  expect(new URL(page.url()).searchParams.get("test_id")).toBe(currentTestId);
  await expect(
    comparison.getByRole("button", { name: /^Failed First run/ }),
  ).toHaveAttribute("aria-pressed", "true");

  const passFigure = comparison.getByRole("figure", {
    name: /^Passed Last pass/,
  });
  const failFigure = comparison.getByRole("figure", {
    name: /^Failed First run/,
  });
  const passTraceLink = passFigure.getByRole("link", {
    name: "Open trace",
    exact: true,
  });
  const failTraceLink = failFigure.getByRole("link", {
    name: "Open trace",
    exact: true,
  });
  await expect(failTraceLink).toHaveAttribute(
    "href",
    (await currentTraceLink.getAttribute("href"))!,
  );
  await expect(passTraceLink).toHaveAttribute("href", /trace\.zip/);
  const passTraceUrl = new URL(
    (await passTraceLink.getAttribute("href"))!,
  ).searchParams.get("trace")!;
  expect(passTraceUrl).not.toBe(currentTraceUrl);
  const failureHeading = comparison.getByRole("heading", {
    level: 3,
    name: /^Click .*Login/,
  });
  const failedStep = comparison
    .getByRole("button")
    .filter({ hasText: "Failed here" });
  await expect(failedStep).toHaveCount(1);
  await expect(
    failedStep.getByRole("img", { name: "Passed", exact: true }),
  ).toBeVisible();
  await expect(
    failedStep.getByRole("img", { name: "Failed", exact: true }),
  ).toBeVisible();
  await expect(failureHeading).toBeVisible();
  await expect(comparison.getByText(/Failed at step 2 of 3/)).toBeVisible();
  await expect(
    comparison.getByText(/tests\/login\.spec\.ts:\d+/, { exact: true }),
  ).toBeVisible();
  await expectComparisonScreenshot(
    comparison,
    "Page after this step in Last pass",
  );
  await expectComparisonScreenshot(
    comparison,
    "Page after this step in First run",
  );

  const fillHeading = comparison.getByRole("heading", {
    level: 3,
    name: /^Fill .*test@example\.com.*Email/,
  });
  await comparison
    .getByRole("button", { name: "Next step", exact: true })
    .click();
  await expect(fillHeading).toBeVisible();
  await expect(
    comparison.getByRole("figure", { name: /^Did not run First run/ }),
  ).toContainText("Step did not run");
  await expect(
    comparison.getByRole("img", {
      name: "Page after this step in First run",
      exact: true,
    }),
  ).toHaveCount(0);
  await expectComparisonScreenshot(
    comparison,
    "Page after this step in Last pass",
  );
  await comparison
    .getByRole("button", { name: "Next step", exact: true })
    .click();
  await expect(fillHeading).toBeVisible();
  await comparison
    .getByRole("button", { name: "Previous step", exact: true })
    .click();
  await expect(failureHeading).toBeVisible();
  await comparison
    .getByRole("button", { name: "Previous step", exact: true })
    .click();
  const navigateHeading = comparison.getByRole("heading", {
    level: 3,
    name: "Navigate /",
    exact: true,
  });
  await expect(navigateHeading).toBeVisible();
  await expect(
    comparison.getByRole("figure", { name: /^Passed First run/ }),
  ).toBeVisible();
  await comparison
    .getByRole("button", { name: "Previous step", exact: true })
    .click();
  await expect(navigateHeading).toBeVisible();
  await failedStep.click();
  await expect(failureHeading).toBeVisible();
  await page.getByRole("tab", { name: /^First run\b/ }).click();
  await expect(attachmentVideo(currentPanel, "video-0")).toHaveAttribute(
    "src",
    currentVideoUrl,
  );
  await page.getByRole("tab", { name: "Compare", exact: true }).click();
  await expect(baseline).toContainText(`#${historicalRunId}`);
  await expect(failTraceLink).toHaveAttribute(
    "href",
    (await currentTraceLink.getAttribute("href"))!,
  );

  // The historical run/report links moved out of the removed video header.
  // Follow the exact selected baseline in Run History, never an arbitrary box.
  const historyLink = page.locator(
    `a[href="/lorem-ipsum/test-runs/${historicalRunId}?pw_test_id=${currentTestId}"]`,
  );
  await expect(historyLink).toHaveCount(1);
  await historyLink.hover();
  await expect(page.getByRole("tooltip")).toHaveAccessibleName(
    new RegExp(
      `^pass Run #${historicalRunId}\\s+\\d{2}/\\d{2}/\\d{2}, \\d{2}:\\d{2}$`,
    ),
  );
  await historyLink.click();
  await expect(page).toHaveURL(
    new RegExp(`/test-runs/${historicalRunId}\\?pw_test_id=${currentTestId}`),
  );
  const passDetail = await expectPassingTestResult(
    page,
    "click login button and input dummy email",
  );
  await expect(passDetail.locator("video")).toHaveCount(1);
  const passVideoUrl = await expectLoadedVideo(passDetail.locator("video"));
  expect(passVideoUrl.split("/attachments/")[0]).toBe(
    passTraceUrl.replace(/\/trace\.zip.*$/, ""),
  );
  const reportLink = passDetail.getByRole("link", {
    name: "View report",
    exact: true,
  });
  await expect(reportLink).toHaveAttribute("href", /index\.html#\?testId=/);
  const reportUrl = (await reportLink.getAttribute("href"))!;
  expect(
    new URLSearchParams(new URL(reportUrl).hash.slice(2)).get("testId"),
  ).toBe(currentTestId);
  expect(passTraceUrl).toContain(`${reportUrl.split("index.html")[0]}data/`);
  const popup = page.waitForEvent("popup");
  await reportLink.click();
  const reportPage = await popup;
  setVideoLabel(reportPage, "test-case-html-report");
  await expect(reportPage).toHaveURL(reportUrl);
  await expect(
    reportPage.getByText("click login button and input dummy email", {
      exact: true,
    }),
  ).toBeVisible();
  await reportPage.close();
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
