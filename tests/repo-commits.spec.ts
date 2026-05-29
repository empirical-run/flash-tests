import { test, expect } from "./fixtures";

type RepoCommit = {
  sha: string;
  author: { login: string } | null;
  commit: {
    author: {
      name: string;
    };
    message: string;
  };
};

function commitTitle(commit: RepoCommit) {
  return commit.commit.message.split("\n")[0] || "Untitled commit";
}

function commitAuthor(commit: RepoCommit) {
  return commit.author?.login || commit.commit.author.name;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstDiffFilePath(diff: string) {
  const diffLine = diff
    .split("\n")
    .find((line) => line.startsWith("diff --git a/"));

  return diffLine?.match(/ b\/(.+)$/)?.[1];
}

test.describe("Repo Commits", () => {
  test("shows commits, auto-selects the first commit, and updates the diff when another commit is selected", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Repository" }).click();
    await expect(page).toHaveURL(/\/repo$/);

    const repoPath = new URL(page.url()).pathname;
    const commitsResponsePromise = page.waitForResponse((response) => {
      if (
        !response.url().includes("/api/github/proxy") ||
        response.request().method() !== "POST"
      ) {
        return false;
      }

      const body = response.request().postDataJSON() as { url?: string };
      return body.url?.includes("/commits?") && body.url.includes("page=1");
    });
    const firstDiffResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/github/commit/diff"),
    );

    await page.goto(`${repoPath}/commits`);
    await expect(page).toHaveURL(/\/repo\/commits$/);

    const commitsResponse = await commitsResponsePromise;
    const commitsRequestBody = commitsResponse.request().postDataJSON() as {
      url: string;
    };
    const commitsRequestUrl = new URL(
      commitsRequestBody.url,
      "https://github.test",
    );
    const defaultBranch = commitsRequestUrl.searchParams.get("sha")!;
    const commits = (await commitsResponse.json()) as RepoCommit[];
    expect(commits.length).toBeGreaterThanOrEqual(2);

    const [firstCommit, secondCommit] = commits;
    const firstShortSha = firstCommit.sha.slice(0, 7);
    const secondShortSha = secondCommit.sha.slice(0, 7);

    await expect(
      page.getByRole("link", { name: "Repository" }).nth(1),
    ).toBeVisible();
    await expect(
      page.getByText("Commits", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(defaultBranch, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Files" })).toBeVisible();

    const firstCommitRow = page.getByRole("button", {
      name: new RegExp(escapeRegex(firstShortSha)),
    });
    await expect(firstCommitRow).toBeVisible();
    await expect(firstCommitRow).toContainText(commitTitle(firstCommit));
    await expect(firstCommitRow).toContainText(commitAuthor(firstCommit));
    await expect(page.getByText(/ago/).first()).toBeVisible();

    const firstDiffResponse = await firstDiffResponsePromise;
    expect(new URL(firstDiffResponse.url()).searchParams.get("ref")).toBe(
      firstCommit.sha,
    );
    const firstDiff = (await firstDiffResponse.json()) as {
      data?: { diff?: string };
    };
    const firstDiffPath = firstDiffFilePath(firstDiff.data?.diff || "");
    expect(firstDiffPath).toBeTruthy();

    const firstDiffHeader = page
      .getByText(firstCommit.sha, { exact: true })
      .locator("xpath=..");
    await expect(firstDiffHeader).toContainText(commitTitle(firstCommit));
    await expect(firstDiffHeader).toContainText(firstCommit.sha);
    await expect(page.getByText(firstDiffPath!).first()).toBeVisible();

    const secondDiffResponsePromise = page.waitForResponse((response) => {
      if (!response.url().includes("/api/github/commit/diff")) {
        return false;
      }

      const url = new URL(response.url());
      return url.searchParams.get("ref") === secondCommit.sha;
    });

    await page
      .getByRole("button", { name: new RegExp(escapeRegex(secondShortSha)) })
      .click();

    const secondDiffResponse = await secondDiffResponsePromise;
    const secondDiff = (await secondDiffResponse.json()) as {
      data?: { diff?: string };
    };
    const secondDiffPath = firstDiffFilePath(secondDiff.data?.diff || "");
    expect(secondDiffPath).toBeTruthy();

    await expect(page.getByText(firstCommit.sha, { exact: true })).not.toBeVisible();
    const secondDiffHeader = page
      .getByText(secondCommit.sha, { exact: true })
      .locator("xpath=..");
    await expect(secondDiffHeader).toContainText(commitTitle(secondCommit));
    await expect(secondDiffHeader).toContainText(secondCommit.sha);
    await expect(page.getByText(secondDiffPath!).first()).toBeVisible();

    // The seeded Lorem Ipsum project points at a repo with more than one page of commits.
    await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();
    const nextPageResponsePromise = page.waitForResponse((response) => {
      if (
        !response.url().includes("/api/github/proxy") ||
        response.request().method() !== "POST"
      ) {
        return false;
      }

      const body = response.request().postDataJSON() as { url?: string };
      return body.url?.includes("/commits?") && body.url.includes("page=2");
    });
    await page.getByRole("button", { name: "Load more" }).click();
    const nextPageResponse = await nextPageResponsePromise;
    const nextPageCommits = (await nextPageResponse.json()) as RepoCommit[];
    expect(nextPageCommits.length).toBeGreaterThan(0);
    await expect(
      page.getByRole("button", {
        name: new RegExp(escapeRegex(nextPageCommits[0].sha.slice(0, 7))),
      }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Files" }).click();
    await expect(page).toHaveURL(/\/repo$/);
  });
});
