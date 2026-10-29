import { Page, Locator, expect } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getDashboardBaseUrl } from "./urls";

/**
 * The project switcher trigger in the header. It shows the currently active
 * project and opens the workspace dropdown menu (Settings, Invite members,
 * Install CLI, Switch project). Located name-agnostically (by role/attributes
 * rather than the current project name) because creating a project changes
 * which project is active by default.
 *
 * Several header controls (More, Home on narrow viewports, the profile menu)
 * are also dropdown-menu triggers; the project switcher is the leading one.
 * openProjectSwitcherList() additionally proves the opened menu is the
 * workspace menu via its "Switch project" item.
 */
export function projectSwitcher(page: Page): Locator {
  return page
    .getByRole("banner")
    .locator('button[data-slot="dropdown-menu-trigger"]')
    .first();
}

/**
 * Opens the project switcher's "Switch project" submenu and returns it. The
 * submenu hosts the searchable project list and the "New project" option.
 */
export async function openProjectSwitcherList(page: Page): Promise<Locator> {
  await projectSwitcher(page).click();
  const switchProject = page.getByRole("menuitem", {
    name: "Switch project",
    exact: true,
  });
  await switchProject.click();
  await expect(switchProject).toHaveAttribute("aria-expanded", "true");
  const projectList = page.getByRole("menu", {
    name: "Switch project",
    exact: true,
  });
  await expect(projectList.getByRole("combobox")).toHaveAttribute(
    "placeholder",
    "Search projects...",
  );
  return projectList;
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

/** Read the milestone for this exact project, never the user's default project. */
export async function expectFirstTestMilestone(
  page: Page,
  slug: string,
  status: "todo" | "done",
): Promise<void> {
  const { Authorization } = await getApiWorkerAuthHeaders(page);
  await expect
    .poll(
      async () => {
        const response = await page.request.get(
          `${getDashboardBaseUrl()}/api/users/me/onboarding`,
          { headers: { Authorization, "x-project-slug": slug } },
        );
        expect(response.ok()).toBeTruthy();
        const { data } = await response.json();
        expect(data.project.slug).toBe(slug);
        return data.items.find(
          (item: { id: string }) => item.id === "first_test",
        )?.status;
      },
      { timeout: 60_000 },
    )
    .toBe(status);
}

/** Submit the real first-test prompt and require the app's session redirect. */
export async function startFirstTestSession(
  page: Page,
  prompt: string,
): Promise<void> {
  await page
    .getByRole("navigation", { name: "Onboarding steps" })
    .getByRole("button", { name: "Write Your First Test", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Write Your First Test", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "What should we test?", exact: true })
    .fill(prompt);
  await page
    .getByRole("button", { name: "Start Session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sessions\/\d+$/);
}

const projectStepHeading = /^(Choose|Create) a Project$/;

/**
 * Opens onboarding's Project step, with "Create new project" selected, via
 * "New project" in the project switcher's "Switch project" submenu.
 */
export async function openNewProjectForm(page: Page): Promise<void> {
  const projectList = await openProjectSwitcherList(page);
  await projectList
    .getByRole("option", { name: "New project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: projectStepHeading }),
  ).toBeVisible();
}

/**
 * Follows "Change" next to the selected org back to the Organization step.
 */
async function openOrganizationStep(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Change" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose an Organization" }),
  ).toBeVisible();
}

/**
 * Picks an existing organization on the Organization step and continues to
 * the Project step.
 */
export async function selectExistingOrganization(
  page: Page,
  orgName: string,
): Promise<void> {
  await openOrganizationStep(page);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: orgName, exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: projectStepHeading }),
  ).toBeVisible();
}

/**
 * Creates a new organization from the Organization step and continues to the
 * Project step.
 */
export async function createNewOrganization(
  page: Page,
  orgName: string,
): Promise<void> {
  await openOrganizationStep(page);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Create new organization" }).click();
  await page.getByRole("textbox", { name: "Organization name" }).fill(orgName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Create a Project" }),
  ).toBeVisible();
}

/**
 * Fills the Project step's project name. The slug is auto-derived by the
 * app; this helper asserts the derived slug so callers get a strong signal that
 * the form reacted correctly before submitting.
 */
export async function fillProjectName(
  page: Page,
  projectName: string,
): Promise<string> {
  const slug = deriveSlug(projectName);
  await page.getByRole("textbox", { name: "Project name" }).fill(projectName);
  await expect(page.getByRole("textbox", { name: "Slug" })).toHaveValue(slug);
  return slug;
}

/**
 * Submits the Project step and waits for onboarding to move on to the new
 * project's next step.
 */
export async function submitAndExpectProject(
  page: Page,
  slug: string,
): Promise<void> {
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(new RegExp(`/onboarding\\?.*project=${slug}`));
  await expect(
    page.getByRole("heading", {
      name: /^(Connect Slack|Write Your First Test)$/,
    }),
  ).toBeVisible();
}
