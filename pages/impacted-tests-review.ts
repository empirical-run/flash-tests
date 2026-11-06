import { expect, Page } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getBranchSha } from "./github";
import { getApiBaseUrl } from "./urls";

/** Independent publication/content proof; the Review UI remains the impacted-test oracle. */
export async function expectPushedLoginEmailChange(
  page: Page,
  branchName: string,
  baseSha: string,
): Promise<string> {
  const sha = await getBranchSha(page, branchName);
  expect(sha).toMatch(/^[a-f0-9]{40}$/i);
  expect(sha).not.toBe(baseSha);
  const headers = await getApiWorkerAuthHeaders(page);
  const repository = "/repos/empirical-run/lorem-ipsum-tests";
  const path = "tests/login.spec.ts";
  const readGitHub = async (url: string) => {
    const response = await page.request.post(
      `${getApiBaseUrl()}/api/github/proxy`,
      { headers, data: { method: "GET", url, owner: "empirical-run" } },
    );
    expect(response.ok(), `Read published fixture: ${url}`).toBeTruthy();
    return await response.json();
  };

  const commit = await readGitHub(`${repository}/commits/${sha}`);
  expect(commit.sha).toBe(sha);
  expect(commit.parents.map((parent: { sha: string }) => parent.sha)).toEqual([
    baseSha,
  ]);
  expect(commit.files).toHaveLength(1);
  expect(commit.files[0]).toMatchObject({
    filename: path,
    status: "modified",
    additions: 1,
    deletions: 1,
  });

  // Compare the complete persisted file against the immutable parent, not an
  // assistant summary or a partial patch that could hide unrelated changes.
  const before = await readGitHub(
    `${repository}/contents/${path}?ref=${baseSha}`,
  );
  const after = await readGitHub(`${repository}/contents/${path}?ref=${sha}`);
  expect(before.encoding).toBe("base64");
  expect(after.encoding).toBe("base64");
  const original = Buffer.from(before.content, "base64").toString("utf8");
  const published = Buffer.from(after.content, "base64").toString("utf8");
  const emailFill = /(\.fill\(\s*["'])([^"'\r\n]*@[^"'\r\n]*)(["']\s*\))/g;
  const matches = [...original.matchAll(emailFill)];
  expect(matches, "Exactly one existing email input fill").toHaveLength(1);
  expect(matches[0][2], "The requested edit must not be a no-op").not.toBe(
    "user@example.com",
  );
  const expected = original.replace(emailFill, "$1user@example.com$3");
  expect(published, "Only the requested input email may change").toBe(expected);
  return sha;
}
