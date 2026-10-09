import { APIRequestContext, APIResponse, Page, Response, expect } from '@playwright/test';
import { getBranchSha } from './github';
import { getDashboardBaseUrl } from './urls';

const repo = 'empirical-run/lorem-ipsum-tests';
export interface OwnedHead { number: number; branch: string; sha: string }
export interface OwnedSessionIdentity {
  id: number; project_id: number; created_by: string; created_at: string;
  source_identifier: string; source: string; mode: string; purpose: string | null;
}
export interface OwnedBaseCreation { ref: string; object: { sha: string } }

/** Same staging-based fixture setup, retaining the real positive creation ACK. */
export async function createOwnedTwoPrBase(page: Page, branch: string): Promise<OwnedBaseCreation> {
  const sha = await getBranchSha(page, 'staging');
  const response = await page.request.post(`${getDashboardBaseUrl()}/api/github/proxy`, {
    headers: { 'Content-Type': 'application/json' },
    data: { method: 'POST', url: `/repos/${repo}/git/refs`, body: { ref: `refs/heads/${branch}`, sha } },
  });
  const acknowledged = await healthyJson(response);
  expect(acknowledged.ref).toBe(`refs/heads/${branch}`);
  expect(acknowledged.object.sha).toBe(sha);
  return acknowledged;
}

/** Capture native UI creation responses without a pending/rejecting wait promise. */
export function observeOwnedSessionCreation(page: Page): () => Promise<OwnedSessionIdentity> {
  const responses: Response[] = [];
  const observe = (response: Response) => {
    if (response.request().method() === 'POST' && response.url().endsWith('/api/chat-sessions')) responses.push(response);
  };
  page.on('response', observe);
  return async () => {
    page.off('response', observe);
    expect(responses, 'Exactly one actual UI session creation ACK required').toHaveLength(1);
    const response = responses[0];
    expect(response.status()).toBe(201);
    expect(response.headers()['content-type']).toContain('application/json');
    return (await response.json()).data.chat_session;
  };
}

interface CleanupOptions {
  request: APIRequestContext;
  apiBaseUrl: string;
  headers: Record<string, string>;
  branch: string;
  baseCreation: OwnedBaseCreation;
  expectedBaseSha: string;
  session?: OwnedSessionIdentity;
  heads: OwnedHead[];
  unprotectBase: () => Promise<void>;
}

/** Fail closed: provider HTML/404/403 and unsupported mutations are never absence proof. */
async function healthyJson(response: APIResponse) {
  expect(response.status(), 'Healthy authenticated JSON readback required').toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  return response.json();
}

/** Only the acknowledged fixture/session and independently observed, unchanged heads. */
export async function cleanupOwnedSessionPrHeads(options: CleanupOptions): Promise<void> {
  const { request, apiBaseUrl, headers, branch, baseCreation, expectedBaseSha, session, heads, unprotectBase } = options;
  const projectId = Number(headers['x-project-id']);
  const actorId = JSON.parse(Buffer.from(headers.Authorization.slice(7).split('.')[1], 'base64url').toString()).sub;
  expect(branch).toMatch(/^two-prs-test-[a-z0-9]+$/);
  expect(baseCreation.ref).toBe(`refs/heads/${branch}`);
  expect(baseCreation.object.sha).toMatch(/^[a-f0-9]{40}$/i);
  expect(expectedBaseSha).toMatch(/^[a-f0-9]{40}$/i);
  const api = async (path: string) => healthyJson(await request.get(`${apiBaseUrl}${path}`, { headers }));
  const project = (await api(`/api/projects/${projectId}`)).data;
  expect(project.id).toBe(projectId);
  expect([project.repo_host, project.repo_owner, project.repo_name]).toEqual(['github', 'empirical-run', 'lorem-ipsum-tests']);
  const proxy = async (method: string, path: string, body?: unknown) => request.post(`${apiBaseUrl}/api/github/proxy`, {
    headers, data: { method, url: `/repos/${repo}${path}`, owner: 'empirical-run', body },
  });
  const github = async (path: string) => healthyJson(await proxy('GET', path));
  const refs = async (name: string) => {
    const list = await github(`/git/matching-refs/heads/${encodeURIComponent(name)}`);
    expect(Array.isArray(list), 'Only a healthy matching-refs array proves absence').toBeTruthy();
    const exact = list.filter((ref: { ref: string }) => ref.ref === `refs/heads/${name}`);
    expect(exact.length).toBeLessThanOrEqual(1);
    return exact;
  };
  const deleteUnchangedRef = async (name: string, sha: string) => {
    const current = await refs(name);
    if (current.length) {
      expect(current[0].object.sha, `Changed ${name}: preserve it, do not delete`).toBe(sha);
      const deletion = await proxy('DELETE', `/git/refs/heads/${encodeURIComponent(name)}`);
      expect([200, 204], 'Unsupported/refused DELETE is not successful cleanup').toContain(deletion.status());
    }
    await expect.poll(() => refs(name), { message: `Healthy exact absence readback for ${name}` }).toEqual([]);
  };

  expect(new Set(heads.map(head => head.branch)).size).toBe(heads.length);
  for (const head of heads) {
    expect([`${branch}-delete`, `${branch}-restore`]).toContain(head.branch);
    expect(head.sha).toMatch(/^[a-f0-9]{40}$/i);
    expect(head.number).toBeGreaterThan(0);
  }
  if (session) {
    expect(session.project_id).toBe(projectId);
    expect(session.created_by).toBe(actorId);
    expect(session.source).toBe('dashboard');
    expect(session.mode).toBe('chat');
    expect(session.purpose).toBeNull(); // Never a Manager/shared-purpose session.
    const identity = async () => {
      const live = (await api(`/api/chat-sessions/${session.id}`)).data.chat_session;
      for (const key of ['id', 'project_id', 'created_by', 'created_at', 'source_identifier', 'source', 'mode', 'purpose'] as const) {
        expect(live[key], `Exact creation identity ${key}`).toBe(session[key]);
      }
      return live;
    };
    if (!(await identity()).is_closed) {
      expect((await request.post(`${apiBaseUrl}/api/chat-sessions/${session.id}/close`, { headers, data: {} })).status()).toBe(200);
    }
    // Stop the owned agent before checking/mutating refs; read back the exact identity.
    expect((await identity()).is_closed).toBe(true);
    const ledger = (await api(`/api/chat-sessions/${session.id}/branches`)).data;
    expect(Array.isArray(ledger)).toBeTruthy();
    for (const name of [`${branch}-delete`, `${branch}-restore`]) {
      const registered = ledger.filter((entry: { branch_name: string }) => entry.branch_name === name);
      const observed = heads.find(head => head.branch === name);
      if (!observed) {
        // A partial failure can push before the test observes its PR/SHA. Preserve it
        // and fail visibly rather than infer ownership/SHA from a name or current tip.
        expect(await refs(name), `Unobserved head ${name}: unsupported cleanup, preserve for investigation`).toEqual([]);
        continue;
      }
      expect(registered, 'Positive session-owned branch registration required').toHaveLength(1);
      const entry = registered[0];
      expect([entry.repo_host, entry.repo_owner, entry.repo_name]).toEqual(['github', 'empirical-run', 'lorem-ipsum-tests']);
      const registrations = entry.pull_requests.filter((pr: { number: number }) => pr.number === observed.number);
      expect(registrations).toHaveLength(1);
      expect(registrations[0].base_branch).toBe(branch);
      const pr = await github(`/pulls/${observed.number}`);
      const assertPrIdentity = (value: typeof pr) => {
        expect(value.number).toBe(observed.number);
        expect(value.head.repo.full_name).toBe(repo);
        expect(value.base.repo.full_name).toBe(repo);
        expect(value.base.ref).toBe(branch);
        expect(value.head.ref).toBe(name);
        expect(value.head.sha, 'Rewritten/foreign head: preserve it').toBe(observed.sha);
      };
      assertPrIdentity(pr);
      const beforeClose = await refs(name);
      if (beforeClose.length) expect(beforeClose[0].object.sha, 'Changed ref: preserve PR and head').toBe(observed.sha);
      if (pr.state === 'open') {
        const closed = await healthyJson(await proxy('PATCH', `/pulls/${observed.number}`, { state: 'closed' }));
        assertPrIdentity(closed);
        expect(closed.state).toBe('closed');
      }
      const closed = await github(`/pulls/${observed.number}`);
      assertPrIdentity(closed);
      expect(closed.state).toBe('closed');
      await deleteUnchangedRef(name, observed.sha);
    }
  } else {
    expect(heads, 'No session identity: no head mutation is supported').toEqual([]);
    for (const name of [`${branch}-delete`, `${branch}-restore`]) expect(await refs(name)).toEqual([]);
  }
  // The base may legitimately advance on the first fixture merge. The test records
  // its independently read current SHA; anything else must be preserved.
  const base = await refs(branch);
  if (base.length) expect(base[0].object.sha, 'Changed owned base: preserve it').toBe(expectedBaseSha);
  await unprotectBase();
  await expect.poll(async () => (await api(`/api/projects/${projectId}`)).data.protected_branches).not.toContain(branch);
  await deleteUnchangedRef(branch, expectedBaseSha);
}
