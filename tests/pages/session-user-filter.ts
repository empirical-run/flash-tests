import { APIResponse, expect, Locator, Page, Response } from "@playwright/test";

// Explicit rollout contracts: legacy visible text and APP #8085's aria-label.
// Each assertion supplies the exact count derived from the selected controls.
function filterButton(page: Page, count: number) {
  const name =
    count === 0
      ? /^Filters$/
      : new RegExp(`^(?:Filters ${count}|Filters, ${count} active)$`);
  return page.locator("main").getByRole("button", { name });
}

function filterPanel(page: Page) {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByRole("checkbox", { name: "Last 30 days only" }) });
}

/** A closed Radix picker can remain mounted during its exit animation. Do not
 * send the outer Escape until this exact controlled child has detached. */
async function dismissUserPicker(page: Page, picker: Locator) {
  await expect(picker).toHaveAttribute("aria-expanded", "true");
  const childId = await picker.getAttribute("aria-controls");
  expect(
    childId,
    "Created by picker controls an exact child popover",
  ).toBeTruthy();
  const child = page.locator(`[id=${JSON.stringify(childId)}]`);
  await expect(child).toHaveAttribute("role", "dialog");
  await page.keyboard.press("Escape");
  await expect(picker).toHaveAttribute("aria-expanded", "false");
  await expect(child).toHaveCount(0);
}

function sessionListResponse(
  response: Response,
  userId: string | null,
  recent: boolean,
) {
  const url = new URL(response.url());
  return (
    url.pathname === "/api/chat-sessions" &&
    url.searchParams.get("page") === "1" &&
    url.searchParams.get("per_page") === "25" &&
    url.searchParams.get("user_ids") === userId &&
    url.searchParams.has("updated_within_days") === recent
  );
}

type SessionListItem = {
  id: number;
  created_by: string;
  is_closed: boolean;
  project_id: number;
};
type SelectedSessionUser = {
  userName: string;
  userId: string;
  sessionId: number;
  projectCount: number;
  queryUrl: string;
};

async function expectSessionList(
  page: Page,
  response: Response | APIResponse,
  userId: string | null,
) {
  expect(response.ok(), "Session list request succeeds").toBe(true);
  let { data }: { data: SessionListItem[] } = await response.json();
  const links = page.locator('main li a[href^="/sessions/"]');
  const projectId = new URL(response.url()).searchParams.get("project_ids");
  // The sidebar is live: other suite users can create/close sessions while this
  // read-only test runs. Compare against a fresh read of the SAME filter query,
  // not a frozen response that the realtime subscription has already superseded.
  await expect
    .poll(async () => {
      const readback = await page.request.get(response.url());
      expect(readback.ok()).toBe(true);
      ({ data } = await readback.json());
      const actualHrefs = await links.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("href")).sort(),
      );
      return {
        nonempty: data.length > 0,
        openOnly: data.every((session) => !session.is_closed),
        usersMatch:
          userId === null ||
          data.every((session) => session.created_by === userId),
        projectsMatch:
          projectId === null ||
          data.every((session) => String(session.project_id) === projectId),
        exactIdentitiesAndCount:
          JSON.stringify(actualHrefs) ===
          JSON.stringify(
            data.map((session) => `/sessions/${session.id}`).sort(),
          ),
      };
    })
    .toEqual({
      nonempty: true,
      openOnly: true,
      usersMatch: true,
      projectsMatch: true,
      exactIdentitiesAndCount: true,
    });
  return data;
}

/** Read-only workflow: select the signed-in user's exact option, prove the query
 * and complete rendered identity set, and return a specific session to inspect.
 * The Project field is superadmin-only; ordinary users have one fewer filter.
 */
export async function filterSessionsByUser(
  page: Page,
): Promise<SelectedSessionUser> {
  await page
    .locator("main")
    .getByRole("button", { name: /^Filters(?: [12]|, [12] active)?$/ })
    .click();
  const panel = filterPanel(page);
  await expect(panel).toBeVisible();
  const project = panel
    .getByRole("group")
    .filter({ hasText: /^Project/ })
    .getByRole("combobox");
  const projectCount = (await project.isVisible()) ? 1 : 0;
  if (projectCount === 1) await expect(project).toHaveText("Lorem Ipsum");
  await expect(
    panel.getByRole("combobox").filter({ hasText: "All users" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("checkbox", { name: "Show closed sessions" }),
  ).not.toBeChecked();
  await expect(
    panel.getByRole("combobox").filter({ hasText: "All statuses" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("checkbox", { name: "Last 30 days only" }),
  ).toBeChecked();
  await expect(filterButton(page, projectCount + 1)).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await panel.getByRole("checkbox", { name: "Last 30 days only" }).uncheck();
  await expect(filterButton(page, projectCount)).toBeVisible();
  await panel.getByRole("combobox").filter({ hasText: "All users" }).click();
  const userName = process.env.AUTOMATED_USER_EMAIL!;
  const option = page.getByRole("option", { name: userName, exact: true });
  await expect(option).toBeVisible();
  const userId = (await option.getAttribute("data-value"))!;
  expect(userId).toMatch(/^[\da-f-]{36}$/);
  const filteredResponse = page.waitForResponse((response) =>
    sessionListResponse(response, userId, false),
  );
  await option.click();
  await dismissUserPicker(
    page,
    panel.getByRole("combobox").filter({ hasText: userName }),
  );
  await expect(
    panel.getByRole("combobox").filter({ hasText: userName }),
  ).toHaveText(userName);
  await expect(
    panel.getByRole("checkbox", { name: "Last 30 days only" }),
  ).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(filterButton(page, projectCount + 1)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  const response = await filteredResponse;
  const sessions = await expectSessionList(page, response, userId);
  // Open the oldest ID in this exact response, not an arbitrary first UI link.
  const sessionId = Math.min(...sessions.map((session) => session.id));
  return {
    userName,
    userId,
    sessionId,
    projectCount,
    queryUrl: response.url(),
  };
}

/** Clear only the selected user, verify the unfiltered identity set, then restore
 * the date control and prove the default count/state without reloading the page. */
export async function resetSessionUserFilter(
  page: Page,
  selected: SelectedSessionUser,
) {
  await filterButton(page, selected.projectCount + 1).click();
  const panel = filterPanel(page);
  await panel
    .getByRole("combobox")
    .filter({ hasText: selected.userName })
    .click();
  const clearedQuery = new URL(selected.queryUrl);
  clearedQuery.searchParams.delete("user_ids");
  await page
    .getByRole("option", { name: selected.userName, exact: true })
    .click();
  await dismissUserPicker(
    page,
    panel.getByRole("combobox").filter({ hasText: "All users" }),
  );
  await expect(
    panel.getByRole("combobox").filter({ hasText: "All users" }),
  ).toHaveText("All users");
  await expect(filterButton(page, selected.projectCount)).toBeVisible();
  // Clearing/restoring can reuse the client's query cache: do not require a
  // redundant network event. UI state and canonical readbacks are the proof.
  await expectSessionList(
    page,
    await page.request.get(clearedQuery.href),
    null,
  );
  const restoredQuery = new URL(clearedQuery);
  restoredQuery.searchParams.set("updated_within_days", "30");
  await panel.getByRole("checkbox", { name: "Last 30 days only" }).check();
  await expect(
    panel.getByRole("checkbox", { name: "Last 30 days only" }),
  ).toBeChecked();
  await expect(
    panel.getByRole("checkbox", { name: "Show closed sessions" }),
  ).not.toBeChecked();
  await expect(
    panel.getByRole("combobox").filter({ hasText: "All statuses" }),
  ).toHaveText("All statuses");
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(filterButton(page, selected.projectCount + 1)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expectSessionList(
    page,
    await page.request.get(restoredQuery.href),
    null,
  );
}

/** Reapply the SAME selected user after reset, including the cache-hit path. */
export async function reapplySessionUserFilter(
  page: Page,
  selected: SelectedSessionUser,
) {
  await filterButton(page, selected.projectCount + 1).click();
  const panel = filterPanel(page);
  await panel.getByRole("checkbox", { name: "Last 30 days only" }).uncheck();
  await panel.getByRole("combobox").filter({ hasText: "All users" }).click();
  const option = page.getByRole("option", {
    name: selected.userName,
    exact: true,
  });
  await expect(option).toHaveAttribute("data-value", selected.userId);
  await option.click();
  await dismissUserPicker(
    page,
    panel.getByRole("combobox").filter({ hasText: selected.userName }),
  );
  await expect(
    panel.getByRole("combobox").filter({ hasText: selected.userName }),
  ).toHaveText(selected.userName);
  await expect(
    panel.getByRole("checkbox", { name: "Last 30 days only" }),
  ).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(filterButton(page, selected.projectCount + 1)).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  const sessions = await expectSessionList(
    page,
    await page.request.get(selected.queryUrl),
    selected.userId,
  );
  return {
    ...selected,
    sessionId: Math.min(...sessions.map((session) => session.id)),
  };
}
