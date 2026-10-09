import { expect, type Page, type Response } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getProjectSlug } from "./settings";
import { getApiBaseUrl } from "./urls";

type ManagerIdentity = { sessionId: number; projectId: number };
type LoaderRecord = Record<string, unknown>;

/** Read the Manager's streamed loader, not an obsolete URL selection or a fixed ID. */
export function readLiveManagerLoader(
  body: string,
  projectSlug: string,
): ManagerIdentity {
  const htmlChunks = [
    ...body.matchAll(/streamController\.enqueue\(("(?:[^"\\]|\\.)*")\)/g),
  ].map((match) => JSON.parse(match[1]) as string);
  // Document navigation embeds turbo-stream chunks; revalidation returns them directly.
  const chunks = htmlChunks.length > 0 ? htmlChunks : body.split("\n");
  const values: unknown[] = [];
  for (const chunk of chunks) {
    const array = chunk.match(/^(?:P\d+:)?(\[.*\])\n?$/s);
    if (array) values.push(...JSON.parse(array[1]));
  }
  const record = (encoded: unknown): LoaderRecord => {
    if (!encoded || Array.isArray(encoded) || typeof encoded !== "object")
      return {};
    return Object.fromEntries(
      Object.entries(encoded)
        .filter(([key]) => /^_\d+$/.test(key))
        .map(([key, ref]) => [
          values[Number(key.slice(1))],
          values[ref as number],
        ]),
    );
  };
  const props = values
    .map(record)
    .find(
      (value) =>
        value.mode === "active" &&
        value.projectSlug === projectSlug &&
        Number.isInteger(value.liveManagerSessionId),
    );
  expect(
    props,
    "Manager loader must resolve the selected project's live Manager",
  ).toBeDefined();
  const session = record(props!.initialSession);
  const lineage = record(props!.managerLineage);
  expect(props!.liveManagerSessionId).toBeGreaterThan(0);
  expect(session).toMatchObject({
    id: props!.liveManagerSessionId,
    project_id: props!.projectId,
    source: "manager",
    mode: "manager",
    is_closed: false,
  });
  expect(lineage.selected_session_id).toBe(session.id);
  return {
    sessionId: session.id as number,
    projectId: session.project_id as number,
  };
}

/** Track live loader revalidations so a rollover does not freeze the initial Manager ID. */
export async function navigateToManager(
  page: Page,
): Promise<() => Promise<ManagerIdentity>> {
  const projectSlug = getProjectSlug();
  const path = `/${projectSlug}/manager`;
  let latestLoader: Response | undefined;
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (
      response.request().method() === "GET" &&
      (url.pathname === path || url.pathname === `${path}.data`)
    ) {
      latestLoader = response;
    }
  });
  await page.goto(path);

  return async () => {
    expect(latestLoader, "Manager must have a loader response").toBeDefined();
    expect(latestLoader!.ok(), "Manager loader must succeed").toBe(true);
    const identity = readLiveManagerLoader(
      await latestLoader!.text(),
      projectSlug,
    );
    expect(identity.projectId).toBe(Number(process.env.LOREM_IPSUM_PROJECT_ID));
    const response = await page.request.get(
      `${getApiBaseUrl()}/api/chat-sessions/${identity.sessionId}`,
      { headers: await getApiWorkerAuthHeaders(page) },
    );
    expect(
      response.ok(),
      "Loaded live Manager metadata must be accessible",
    ).toBe(true);
    const { data } = await response.json();
    expect(data.chat_session).toMatchObject({
      id: identity.sessionId,
      project_id: identity.projectId,
      source: "manager",
      mode: "manager",
      is_closed: false,
      source_identifier: String(identity.projectId),
    });
    return identity;
  };
}
