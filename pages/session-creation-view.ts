import { Page, expect } from "@playwright/test";

/** The shared Sessions landing must be ready for the new user to start a session. */
export async function expectSessionCreationViewReady(
  page: Page,
): Promise<void> {
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "Create a new session", exact: true }),
  ).toBeVisible();
  const prompt = main.getByRole("textbox", {
    name: "Enter a prompt to start a session",
    exact: true,
  });
  await expect(prompt).toBeVisible();
  await expect(prompt).toBeEnabled();
  await expect(prompt).toBeEditable();
}
