import { expect, Locator, Page } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";

/** Native published commit markers, including compact expandable rows. */
export function getCommitCards(response: Locator): Locator {
  const page = response.page();
  return response
    .getByRole("button", { disabled: false })
    .and(response.getByTitle(/^Commit [a-f0-9]{40}(?: on .+)?$/i))
    .filter({
      // Do not accept a nested duplicate or a sandbox-only commit.
      hasNot: page.locator('[role="button"][title^="Commit "]'),
      hasNotText: /\bNot pushed\b/i,
    });
}

/** A card must be displayed in this response and identify the actual pushed SHA. */
export function getCommitCardForSha(response: Locator, sha: string): Locator {
  expect(sha).toMatch(/^[a-f0-9]{40}$/i);
  return getCommitCards(response).and(
    response.getByTitle(new RegExp(`^Commit ${sha}(?: on .+)?$`, "i")),
  );
}

/** Branch identity is in compact-row titles or legacy-card metadata. */
export function getCommitCardForBranch(
  response: Locator,
  branch: string,
): Locator {
  const escapedBranch = branch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cards = getCommitCards(response);
  return cards
    .filter({ has: response.page().getByText(branch, { exact: true }) })
    .or(
      cards.and(
        response.getByTitle(
          new RegExp(`^Commit [a-f0-9]{40} on ${escapedBranch}$`, "i"),
        ),
      ),
    );
}

/** Reveal this commit's own action, never one borrowed from another card. */
export async function expandCommitCard(card: Locator): Promise<Locator> {
  await expect(card).toBeVisible();
  // Like other disclosure helpers, click only when this visible row is collapsed.
  // Legacy production cards have no disclosure state and already show the action.
  if ((await card.getAttribute("aria-expanded")) === "false") {
    await card.click();
    await expect(card).toHaveAttribute("aria-expanded", "true");
  }
  // Compact details are immediate siblings of THIS marker, never a parent that
  // could contain another commit. Legacy cards contain their action instead.
  const action = card
    .getByRole("button", { name: "View changes", exact: true })
    .or(
      card
        .locator("xpath=following-sibling::*[1]")
        .getByRole("button", { name: "View changes", exact: true }),
    );
  await expect(action).toHaveCount(1);
  await expect(action).toBeVisible();
  await expect(action).toBeEnabled();
  return action;
}

export async function openCommitChanges(card: Locator): Promise<void> {
  const action = await expandCommitCard(card);
  await action.click();
}

/** Read GitHub's PR head independently; never obtain a SHA from a commit card/diff. */
export async function getDisplayedPrHead(
  page: Page,
  baseBranch: string,
  headBranch: string,
  expectedParentSha: string,
) {
  const headerButton = page
    .locator("main header")
    .getByRole("button", { name: /PR #\d+/ });
  await expect(headerButton).toHaveCount(1);
  const number = Number(
    (await headerButton.innerText()).match(/PR #(\d+)/)?.[1],
  );
  expect(number).toBeGreaterThan(0);
  const response = await page.request.post(
    `${getApiBaseUrl()}/api/github/proxy`,
    {
      headers: await getApiWorkerAuthHeaders(page),
      data: {
        method: "GET",
        url: `/repos/empirical-run/lorem-ipsum-tests/pulls/${number}`,
        owner: "empirical-run",
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  const pr = await response.json();
  expect(pr.number).toBe(number);
  expect(pr.state).toBe("open");
  expect(pr.base.ref).toBe(baseBranch);
  expect(pr.head.repo.full_name).toBe("empirical-run/lorem-ipsum-tests");
  expect(pr.head.ref).toBe(headBranch);
  expect(pr.head.sha).toMatch(/^[a-f0-9]{40}$/i);
  expect(pr.base.sha).toBe(expectedParentSha);
  const commitResponse = await page.request.post(
    `${getApiBaseUrl()}/api/github/proxy`,
    {
      headers: await getApiWorkerAuthHeaders(page),
      data: {
        method: "GET",
        url: `/repos/empirical-run/lorem-ipsum-tests/commits/${pr.head.sha}`,
        owner: "empirical-run",
      },
    },
  );
  expect(commitResponse.ok()).toBeTruthy();
  const commit = await commitResponse.json();
  expect(commit.sha).toBe(pr.head.sha);
  expect(
    commit.parents.map((parent: { sha: string }) => parent.sha),
    "Current owned base established before the commit",
  ).toContain(expectedParentSha);
  return { number, sha: pr.head.sha as string };
}

/** The tool's own expanded Input is the UI's untruncated command contract. */
export function getBashInput(tool: Locator): Locator {
  return tool
    .locator("..")
    .getByTestId("inline-tool-details")
    .locator("section")
    .filter({
      has: tool.page().getByRole("heading", { name: "Input", exact: true }),
    })
    .locator("pre");
}

export async function openBashWithFullCommand(
  response: Locator,
  command: string,
  status: "running" | "used",
  toolName = "bash",
) {
  // Only one bash call is allowed in this deliberately single-command turn.
  // No first()/last(), summary matching, or other-turn fallback.
  const tool = response.getByTestId(`${status}-${toolName}`);
  await expect(tool).toHaveCount(1, { timeout: 120000 });
  // Preparing shares running-bash's test ID and is remounted when execution starts.
  // Require the actual execution-state label BEFORE opening its real Input.
  const label = { running: "Running", used: "Used" }[status];
  await expect(tool).toContainText(new RegExp(`\\b${label} ${toolName}:`));
  await tool.click();
  const input = getBashInput(tool);
  await expect(input).toBeVisible();
  expect(
    JSON.parse(await input.innerText()).command,
    "Actual full UI tool command",
  ).toBe(command);
  await expect(tool).toBeVisible();
  return tool;
}

export function getBashOutput(tool: Locator): Locator {
  return tool
    .locator("..")
    .getByTestId("inline-tool-details")
    .locator("section")
    .filter({
      has: tool.page().getByRole("heading", { name: "Output", exact: true }),
    });
}
