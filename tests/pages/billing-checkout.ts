import { expect, Page } from "@playwright/test";
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
    page.getByRole("button", { name: "Subscribe", exact: true }),
  ).toHaveCount(0);
}
