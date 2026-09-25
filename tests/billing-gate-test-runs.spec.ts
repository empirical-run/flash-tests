import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import { getApiBaseUrl, isPreviewEnvironment } from "./pages/urls";

test.skip(
  () => !isPreviewEnvironment(),
  "The overdue-invoice project and unpaid invoice are seeded on preview only",
);
test.use({ selectedProjectSlug: "overdue-invoice" });

let createdEnvironment: { id: number; projectId: number } | undefined;

test.afterEach(async ({ page }) => {
  if (createdEnvironment) {
    const response = await page.request.delete(
      `${getApiBaseUrl()}/api/environments/${createdEnvironment.id}`,
      {
        headers: {
          ...(await getApiWorkerAuthHeaders(page)),
          "x-project-id": String(createdEnvironment.projectId),
        },
      },
    );
    expect(response.ok()).toBeTruthy();
    createdEnvironment = undefined;
  }
});

test("billing gate rejects new test runs for an overdue invoice", async ({
  page,
}) => {
  // The overdue-invoice fixture has no environments. Create one so the dialog
  // can submit a valid run request and exercise the billing gate, not the
  // ordinary disabled-button state for an unselected environment.
  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/test-runs?") &&
      response.request().method() === "GET",
  );
  await page.goto("/overdue-invoice/test-runs");
  const projectId = (await (await listResponse).json()).data.project.id;
  const headers = {
    ...(await getApiWorkerAuthHeaders(page)),
    "x-project-id": String(projectId),
  };
  const environmentName = `Billing Gate ${randomUUID()}`;
  const environmentResponse = await page.request.post(
    `${getApiBaseUrl()}/api/environments`,
    {
      headers,
      data: {
        name: environmentName,
        slug: environmentName.toLowerCase().replaceAll(" ", "-"),
      },
    },
  );
  expect(environmentResponse.ok()).toBeTruthy();
  createdEnvironment = {
    id: (await environmentResponse.json()).data.environment.id,
    projectId,
  };

  // Refresh the environment list cached when the Test Runs page first mounted.
  await page.reload();
  await page.getByRole("button", { name: "New Test Run" }).click();
  const dialog = page.getByRole("dialog", { name: "New Test Run" });
  await dialog.getByRole("combobox", { name: "Environment" }).click();
  await page
    .getByRole("option", { name: environmentName, exact: true })
    .click();
  const trigger = dialog.getByRole("button", { name: "Trigger Test Run" });
  await expect(trigger).toBeEnabled();

  const rejectedRun = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/test-runs") &&
      response.request().method() === "PUT",
  );
  await trigger.click();
  const response = await rejectedRun;
  const billingMessage =
    "Your organisation has an invoice that is 14 or more days overdue. Pay it in Settings → Invoices to continue.";
  expect(response.status()).toBe(402);
  expect((await response.json()).error.message).toBe(billingMessage);
  await expect(page.getByText(billingMessage, { exact: true })).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/overdue-invoice\/test-runs\/?$/);
  const screenshotPath = test
    .info()
    .outputPath("overdue-invoice-run-rejected.png");
  await page.screenshot({ path: screenshotPath });
  await test.info().attach("overdue-invoice-run-rejected", {
    path: screenshotPath,
    contentType: "image/png",
  });
});
