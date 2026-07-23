import { Page, Locator, expect } from "@playwright/test";

/**
 * The project switcher trigger in the header. It shows the currently active
 * project and opens a command-palette dialog on click. Located name-agnostically
 * (by role/attributes rather than the current project name) because creating a
 * project changes which project is active by default.
 */
export function projectSwitcher(page: Page): Locator {
  return page
    .locator('header button[data-slot="popover-trigger"][aria-haspopup="dialog"]')
    .first();
}

/**
 * Derives the URL-friendly slug the app auto-generates from a project name:
 * lowercased, non-alphanumeric runs collapsed to single hyphens, and trimmed.
 */
export function deriveSlug(projectName: string): string {
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Opens the "Create Project" page via the project switcher in the header.
 *
 * Clicking the switcher opens a command-palette dialog that lists projects plus
 * a "New project" action.
 */
export async function openNewProjectForm(page: Page): Promise<void> {
  await projectSwitcher(page).click();
  await page.getByRole("option", { name: "New project" }).click();
  await expect(
    page.getByRole("heading", { name: "Create Project" }),
  ).toBeVisible();
}

/**
 * Selects an existing organization in the "1. Organization" combobox.
 */
export async function selectExistingOrganization(
  page: Page,
  orgName: string,
): Promise<void> {
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: orgName, exact: true }).click();
}

/**
 * Chooses "Create new organization" in the org combobox and fills in the
 * revealed organization fields. The email domain must match the signed-in
 * user's own email domain, otherwise the backend rejects the request.
 */
export async function createNewOrganization(
  page: Page,
  orgName: string,
  emailDomain: string,
): Promise<void> {
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Create new organization" }).click();
  await page.getByRole("textbox", { name: "Organization Name" }).fill(orgName);
  await page
    .getByRole("textbox", { name: "Email Domains (comma separated)" })
    .fill(emailDomain);
}

/**
 * Fills the "2. Project Details" project name. The slug is auto-derived by the
 * app; this helper asserts the derived slug and repo preview so callers get a
 * strong signal that the form reacted correctly before submitting.
 */
export async function fillProjectName(
  page: Page,
  projectName: string,
): Promise<string> {
  const slug = deriveSlug(projectName);
  await page.getByRole("textbox", { name: "Project Name" }).fill(projectName);
  await expect(page.getByRole("textbox", { name: "Slug" })).toHaveValue(slug);
  await expect(page.getByText(`Repo: ${slug}-tests`)).toBeVisible();
  return slug;
}

/**
 * Submits the create-project form and waits for the app to land on the new
 * project (the sessions page) with the new project active in the switcher.
 */
export async function submitAndExpectProject(
  page: Page,
  projectName: string,
): Promise<void> {
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/sessions$/);
  await expect(
    page.getByRole("button", { name: new RegExp(projectName) }),
  ).toBeVisible();
}
