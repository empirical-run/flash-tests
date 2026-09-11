import { test, expect } from "./fixtures";
import { navigateToManager } from "./pages/manager";
import { getProjectSlug } from "./pages/settings";

test.describe("Manager Page", () => {
  test("opens the selected project manager with its lineage and message composer", async ({
    page,
  }) => {
    await navigateToManager(page);

    const projectSlug = getProjectSlug();
    await expect(page).toHaveURL(
      new RegExp(`/${projectSlug}/manager\\?session=\\d+$`),
    );
    await expect(
      page.getByText("Manager Lineage", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Managers", { exact: true })).toBeVisible();

    const sessionCountLabel = page.getByText(/^\d+ sessions?$/).first();
    await expect(sessionCountLabel).toBeVisible();
    const sessionCount = Number(
      (await sessionCountLabel.textContent())?.match(/\d+/)?.[0],
    );
    expect(sessionCount).toBeGreaterThan(0);
    await expect(
      page.getByRole("link", { name: /^Manager #\d+/ }).first(),
    ).toBeVisible();

    const selectedManagerId = new URL(page.url()).searchParams.get("session");
    expect(selectedManagerId).toMatch(/^\d+$/);
    const selectedManagerLink = page.getByRole("link", {
      name: new RegExp(`^Manager #${selectedManagerId}\\b`),
    });
    await expect(selectedManagerLink).toBeVisible();
    await expect(selectedManagerLink).toHaveAttribute(
      "href",
      `/${projectSlug}/manager?session=${selectedManagerId}`,
    );

    await expect(page.getByRole("region", { name: "Messages" })).toBeVisible();
    const composer = page.getByRole("textbox", {
      name: "Type your message here...",
    });
    const sendButton = page.getByRole("button", { name: /^Send/ });
    const stopButton = page.getByRole("button", { name: /^Stop/ });
    await expect(composer).toBeEditable();
    await expect(sendButton.or(stopButton)).toBeVisible();

    if (await sendButton.isVisible()) {
      await expect(sendButton).toBeDisabled();
      await composer.fill("Draft manager question");
      await expect(sendButton).toBeEnabled();
      await composer.clear();
      await expect(sendButton).toBeDisabled();
    } else {
      await expect(stopButton).toBeVisible();
      await expect(page.getByRole("button", { name: /^Steer/ })).toBeVisible();
    }

    await page.getByRole("button", { name: "Show session lineage" }).click();
    const lineageDialog = page.getByRole("dialog", { name: "Session lineage" });
    await expect(
      lineageDialog.getByText("Manager sessions and executors"),
    ).toBeVisible();
    await expect(
      lineageDialog.getByRole("link", {
        name: new RegExp(`Manager #${selectedManagerId} Viewing`),
      }),
    ).toHaveAttribute("href", `/sessions/${selectedManagerId}`);
  });
});
