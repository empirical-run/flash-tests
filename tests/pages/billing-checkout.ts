import { expect, Page, TestInfo } from "@playwright/test";
import { getApiBaseUrl } from "./urls";

/** Exercise the real Dodo test checkout, including its hosted card iframe. */
export async function completeTestSubscriptionCheckout(page: Page) {
  // Fail closed before entering any payment details if checkout is live-mode.
  await expect(page).toHaveURL(
    /^https:\/\/test\.checkout\.dodopayments\.com\//,
  );
  await expect(page.getByText("Test Mode", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Managed", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Enter address manually" }).click();
  await page
    .getByRole("combobox", { name: "Country", exact: true })
    .selectOption({ label: "United States" });
  await page
    .getByRole("textbox", { name: "Address Line", exact: true })
    .fill("424 Test Street");
  await page
    .getByRole("textbox", { name: "City", exact: true })
    .fill("San Francisco");
  await page
    .getByRole("textbox", { name: "Zip Code", exact: true })
    .fill("94105");
  await page
    .getByRole("textbox", { name: "State", exact: true })
    .fill("California");
  await page
    .getByRole("button", { name: "Continue to Payment", exact: true })
    .click();

  await expect(page).toHaveURL(
    /^https:\/\/test\.checkout\.dodopayments\.com\//,
  );
  await expect(page.getByText("Test Mode", { exact: true })).toBeVisible();
  const card = page.frameLocator("#dodo-checkout-iframe-payment");
  await card
    .getByRole("textbox", { name: "Card number", exact: true })
    .fill("4242424242424242");
  const expiryYear = String(new Date().getUTCFullYear() + 3).slice(-2);
  await card
    .getByRole("textbox", { name: "Expiry", exact: true })
    .fill(`12${expiryYear}`);
  await card
    .getByRole("textbox", { name: "Security code", exact: true })
    .fill("123");
  await page.getByRole("button", { name: "Pay now", exact: true }).click();
}

/** Reload to verify a persisted, webhook-activated subscription, not just return params. */
export async function expectPersistedManagedSubscription(page: Page) {
  const planResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url() === `${getApiBaseUrl()}/api/plan-assignments/org`,
  );
  await page.reload();
  const planResponse = await planResponsePromise;
  expect(planResponse.status()).toBe(200);
  const { data } = await planResponse.json();
  expect(data.has_plan).toBe(true);
  expect(data.plan).toMatchObject({
    name: "Managed",
    currency: "usd",
    base_price_cents: 35000,
  });
  expect(data.subscription.status).toBe("active");
  const renewal = new Date(data.subscription.next_billing_date);
  expect(renewal.getTime()).toBeGreaterThan(Date.now());
  await expect(
    page.getByText(
      `Renews on ${renewal.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage billing", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Continue to payment", exact: true }),
  ).toHaveCount(0);
  const projectId = planResponse.request().headers()["x-project-id"];
  expect(projectId).toMatch(/^\d+$/);
  return { projectId, renewal };
}

/** End the subscription through the app, then prove it stays ended after reload. */
export async function endTestSubscriptionThroughUi(
  page: Page,
  returnedUrl: URL,
  projectId: string,
  renewal: Date,
  testInfo: TestInfo,
) {
  // The real checkout return was captured before app PR #7945 clears it.
  // Assert cleanup on that same origin/project, not a manual navigation.
  const subscriptionId = returnedUrl.searchParams.get("subscription_id")!;
  expect(subscriptionId).toMatch(/^sub_/);
  await expect(page).toHaveURL(`${returnedUrl.origin}${returnedUrl.pathname}`);
  await page.getByRole("button", { name: "End plan", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "End your plan now?" });
  await expect(dialog).toContainText(
    `Your plan was paid through ${renewal.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}; ending now gives up the rest. New runs and sessions stop right away. You can subscribe again any time.`,
  );
  // Dismissing the confirmation must leave this subscription active.
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Manage billing", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "End plan", exact: true }).click();

  const endResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url() === `${getApiBaseUrl()}/api/billing/subscription/end`,
  );
  await dialog.getByRole("button", { name: "End plan", exact: true }).click();
  const endResponse = await endResponsePromise;
  expect(endResponse.request().headers()["x-project-id"]).toBe(projectId);
  expect(endResponse.status()).toBe(200);
  const { data: ended } = await endResponse.json();
  // Retain the cleanup outcome even if a later UI assertion catches a bug.
  await testInfo.attach("billing-end-response", {
    body: JSON.stringify({ subscriptionId, projectId, ended }, null, 2),
    contentType: "application/json",
  });
  expect(ended).toMatchObject({ status: "cancelled", final_charge: false });
  await expect(dialog).toHaveCount(0);
  // The transient "Your plan has ended" can disappear as soon as the refetch
  // lands. Assert the stable re-subscribe UI, not that optimistic message.
  await expect(
    page.getByRole("button", { name: "Continue to payment", exact: true }),
  ).toBeEnabled();

  const planResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url() === `${getApiBaseUrl()}/api/plan-assignments/org`,
  );
  await page.reload();
  const planResponse = await planResponsePromise;
  expect(planResponse.request().headers()["x-project-id"]).toBe(projectId);
  expect(planResponse.status()).toBe(200);
  const { data: plan } = await planResponse.json();
  expect(plan).toMatchObject({
    has_plan: false,
    plan: null,
    subscription: null,
  });
  await expect(
    page.getByRole("button", { name: "Continue to payment", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Manage billing", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "End plan", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/^Renews on /)).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({
      hasText: "Your organisation is not on a billing plan.",
    }),
  ).toBeVisible();
  return { subscriptionId, projectId, ended, persistedPlan: plan };
}
