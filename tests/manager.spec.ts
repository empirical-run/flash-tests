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
    const managerPage = page.getByRole("main");
    await expect(
      managerPage.getByText("Sessions", { exact: true }),
    ).toBeVisible();
    await expect(
      managerPage.getByText("Manager Session", { exact: true }),
    ).toBeVisible();
    await expect(
      managerPage.getByText("Executors", { exact: true }),
    ).toBeVisible();
    await expect(
      managerPage.getByText("User Sessions", { exact: true }),
    ).toBeVisible();

    const selectedManagerId = new URL(page.url()).searchParams.get("session");
    expect(selectedManagerId).toMatch(/^\d+$/);
    const selectedManagerLink = managerPage.getByRole("link", {
      name: /^Live Updated /,
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

    // The shared manager may be idle (Send) or actively working (Stop/Steer).
    // Wait for either valid state before using isVisible() to select its assertions.
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
