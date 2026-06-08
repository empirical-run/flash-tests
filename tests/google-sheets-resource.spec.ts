import { test, expect } from "./fixtures";
import { createSession, navigateToSessions, waitForFirstMessage } from "./pages/sessions";
import {
  deleteResource,
  ensureGoogleSheetResource,
  getFirstSheetProperties,
  listGoogleSheetResources,
  readGoogleSheetValues,
  resetGoogleSheetTestData,
  GOOGLE_SHEET_ID,
} from "./pages/google-sheets";

test.describe("Google Sheets resources", () => {
  test.afterEach(async ({ page }) => {
    const resources = await listGoogleSheetResources(page);
    for (const resource of resources) {
      await deleteResource(page, resource.id);
    }
  });

  test("agent can use a Google Sheet resource and update the sheet", async ({ page, trackCurrentSession }) => {
    await ensureGoogleSheetResource(page);

    const sheetProperties = await getFirstSheetProperties(page);
    await resetGoogleSheetTestData(page, sheetProperties.title);

    await navigateToSessions(page);
    await createSession(
      page,
      [
        `Use the Google Sheet project resource with spreadsheet ID ${GOOGLE_SHEET_ID}.`,
        "Find the row where Task ID is EMP-GSHEET-E2E.",
        "Update only that row: set Status to Complete and set Agent Note to verified by empirical google sheets resource test.",
        "Leave every other row unchanged. Do not create or delete rows. After updating, briefly summarize the exact cell changes you made.",
      ].join(" ")
    );

    await waitForFirstMessage(page);
    trackCurrentSession(page);

    await expect(page.getByText(/Used .*tool|Used \d+ tools/).first()).toBeVisible({ timeout: 180000 });

    const expectedValues = [
      ["Task ID", "Owner", "Status", "Agent Note"],
      ["EMP-GSHEET-E2E", "Empirical QA", "Complete", "verified by empirical google sheets resource test"],
      ["CONTROL-ROW", "Do not edit", "Leave alone", "unchanged"],
    ];

    await expect
      .poll(
        async () => await readGoogleSheetValues(page, sheetProperties.title, "A1:D3"),
        {
          timeout: 300000,
          intervals: [5000, 10000, 15000],
        }
      )
      .toEqual(expectedValues);

    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 30000 });
  });
});
