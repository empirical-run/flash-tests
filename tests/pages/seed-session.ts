import { expect, Page } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";

export type SeededSession = {
  id: number;
  projectId: number;
  headers: Record<string, string>;
};

/** Seed history without a first agent turn or a billing-gated creation request. */
export async function seedWorkerSession(
  page: Page,
  projectSlug: string,
  messages: { role: "user" | "assistant"; text: string }[],
): Promise<SeededSession> {
  const authHeaders = await getApiWorkerAuthHeaders(page);
  const projectsResponse = await page.request.get(
    `${getApiBaseUrl()}/api/projects`,
    {
      headers: authHeaders,
    },
  );
  expect(projectsResponse.ok()).toBeTruthy();
  const projects = (await projectsResponse.json()).data.projects;
  const project = projects.find(
    (candidate: { slug: string }) => candidate.slug === projectSlug,
  );
  expect(project?.id, `Project ${projectSlug} exists`).toBeTruthy();
  // The auth helper defaults to Lorem Ipsum; target this fixture's project.
  const headers = { ...authHeaders, "x-project-id": String(project.id) };

  // Internal seed routes live on the API worker, not the dashboard deployment.
  const response = await page.request.post(
    `${getApiBaseUrl()}/api/internal/seed/chat-sessions`,
    { headers, data: { agent: "worker", messages } },
  );
  expect(response.status(), await response.text()).toBe(201);
  const session = (await response.json()).data.chat_session;
  expect(session.id).toBeGreaterThan(0);
  return { id: session.id, projectId: project.id, headers };
}

/** Close only this attempt's seed and verify the exact session's closed state. */
export async function closeSeededSession(page: Page, session: SeededSession) {
  const response = await page.request.post(
    `${getApiBaseUrl()}/api/chat-sessions/${session.id}/close`,
    {
      headers: session.headers,
    },
  );
  expect(response.ok()).toBeTruthy();
  await expect
    .poll(async () => {
      const readback = await page.request.get(
        `${getApiBaseUrl()}/api/chat-sessions/${session.id}`,
        {
          headers: session.headers,
        },
      );
      expect(readback.ok()).toBeTruthy();
      return (await readback.json()).data.chat_session.is_closed;
    })
    .toBe(true);
}
