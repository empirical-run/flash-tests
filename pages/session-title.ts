import { expect, type Page } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getProjectSlug } from "./settings";
import { getApiBaseUrl } from "./urls";

type SessionTitleMetadata = { id: number; project_id: number; title: string };
type ProjectMetadata = {
  id: number;
  slug: string;
  repo_owner: string;
  repo_name: string;
};

/** Keep mutable fixture descriptions exact; repository context is not a title suffix. */
export function canonicalSessionTitle(
  session: SessionTitleMetadata,
  project: ProjectMetadata,
  sessionId: number,
): string {
  expect(session).toMatchObject({
    id: sessionId,
    project_id: Number(process.env.LOREM_IPSUM_PROJECT_ID),
  });
  expect(session.title).toEqual(expect.any(String));
  expect(session.title.trim()).not.toBe("");
  expect(project).toMatchObject({
    id: session.project_id,
    slug: getProjectSlug(),
    repo_owner: "empirical-run",
    repo_name: "lorem-ipsum-tests",
  });
  return `Session #${sessionId} · ${session.title} · Empirical`;
}

async function getSessionMetadata(
  page: Page,
  sessionId: number,
): Promise<SessionTitleMetadata> {
  const headers = await getApiWorkerAuthHeaders(page);
  const sessionResponse = await page.request.get(
    `${getApiBaseUrl()}/api/chat-sessions/${sessionId}`,
    { headers },
  );
  expect(
    sessionResponse.ok(),
    "Existing session metadata must be healthy",
  ).toBe(true);
  const { data: sessionData } = await sessionResponse.json();
  const session: SessionTitleMetadata = sessionData.chat_session;
  expect(session.id).toBe(sessionId);
  return session;
}

/**
 * The persisted session title. Titles are AI-generated from the conversation and
 * can be rewritten after each turn (the initial prompt is only a placeholder), so
 * callers should re-read it inside `expect(...).toPass()` when comparing to the UI.
 */
export async function getSessionTitle(
  page: Page,
  sessionId: number,
): Promise<string> {
  const session = await getSessionMetadata(page, sessionId);
  expect(session.title.trim()).not.toBe("");
  return session.title;
}

/** Read-only identity/context checks for an existing session; never close or mutate it. */
export async function expectCanonicalSessionTitle(
  page: Page,
  sessionId: number,
): Promise<void> {
  const headers = await getApiWorkerAuthHeaders(page);
  // The generated title can change between the API read and the page render,
  // so re-read the persisted title until the page shows the same one.
  await expect(async () => {
    const session = await getSessionMetadata(page, sessionId);
    const projectResponse = await page.request.get(
      `${getApiBaseUrl()}/api/projects/${session.project_id}`,
      { headers },
    );
    expect(
      projectResponse.ok(),
      "Session project metadata must be healthy",
    ).toBe(true);
    const { data: projectData } = await projectResponse.json();
    await expect(page).toHaveTitle(
      canonicalSessionTitle(session, projectData, sessionId),
      { timeout: 5_000 },
    );
  }).toPass({ timeout: 30_000 });
}
