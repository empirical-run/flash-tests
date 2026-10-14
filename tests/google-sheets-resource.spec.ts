import { test, expect } from "./fixtures";
import {
  createWorkerSession,
  navigateToSessions,
  waitForFirstMessage,
} from "./pages/sessions";
import {
  getFirstSheetProperties,
  readGoogleSheetValues,
  resetGoogleSheetTestData,
  GOOGLE_SHEET_URL,
} from "./pages/google-sheets";

test.describe("Google Sheets", () => {
  test("agent can use a Google Sheet link and update the sheet", async ({
    page,
    trackCurrentSession,
  }) => {
    const sheetProperties = await getFirstSheetProperties(page);
    await resetGoogleSheetTestData(page, sheetProperties.title);

    await navigateToSessions(page);
    await createWorkerSession(
      page,
      [
        `Use this Google Sheet: ${GOOGLE_SHEET_URL}.`,
        "Find the row where Task ID is EMP-GSHEET-E2E.",
        "Update only that row: set Status to Complete and set Agent Note to verified by empirical google sheets test.",
        "Leave every other row unchanged. Do not create or delete rows. After updating, briefly summarize the exact cell changes you made.",
      ].join(" "),
    );

    await waitForFirstMessage(page);
    trackCurrentSession(page);

    await expect(
      page.getByText(/^Used (?:[a-z_][\w-]*|\d+ tools)\b/i).first(),
    ).toBeVisible({ timeout: 180000 });

    const expectedValues = [
      ["Task ID", "Owner", "Status", "Agent Note"],
      [
        "EMP-GSHEET-E2E",
        "Empirical QA",
        "Complete",
        "verified by empirical google sheets test",
      ],
      ["CONTROL-ROW", "Do not edit", "Leave alone", "unchanged"],
    ];

    await expect
      .poll(
        async () =>
          await readGoogleSheetValues(page, sheetProperties.title, "A1:D3"),
        {
          timeout: 300000,
          intervals: [5000, 10000, 15000],
        },
      )
      .toEqual(expectedValues);

    await expect(page.getByRole("button", { name: /^Stop/ })).toBeHidden({
      timeout: 120000,
    });
  });
});
