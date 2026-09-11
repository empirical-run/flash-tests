import { test, expect } from "./fixtures";
import { navigateToManager } from "./pages/manager";
import { getProjectSlug } from "./pages/settings";

test.describe("Manager Page", () => {
  test("opens the live project manager with its lineage and message composer", async ({
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

    const managerLinks = page.getByRole("link", { name: /^Manager #\d+/ });
    await expect(managerLinks).toHaveCount(sessionCount);

    const liveManagerLink = page.getByRole("link", {
      name: /^Manager #\d+ Live/,
    });
    await expect(liveManagerLink).toBeVisible();
    const liveManagerHref = await liveManagerLink.getAttribute("href");
    const liveManagerId = liveManagerHref?.match(/session=(\d+)/)?.[1];
    expect(liveManagerId).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`session=${liveManagerId}$`));

    await expect(page.getByRole("region", { name: "Messages" })).toBeVisible();
    const composer = page.getByRole("textbox", {
      name: "Type your message here...",
    });
    const sendButton = page.getByRole("button", { name: /^Send/ });
    await expect(composer).toBeEditable();
    await expect(sendButton).toBeDisabled();

    await composer.fill("Draft manager question");
    await expect(sendButton).toBeEnabled();
    await composer.clear();
    await expect(sendButton).toBeDisabled();

    await page.getByRole("button", { name: "Show session lineage" }).click();
    const lineageDialog = page.getByRole("dialog", { name: "Session lineage" });
    await expect(
      lineageDialog.getByText("Manager sessions and executors"),
    ).toBeVisible();
    await expect(
      lineageDialog.getByRole("link", {
        name: new RegExp(`Manager #${liveManagerId} Viewing`),
      }),
    ).toHaveAttribute("href", `/sessions/${liveManagerId}`);
  });
});
