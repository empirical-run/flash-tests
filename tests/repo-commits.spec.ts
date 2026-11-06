import { test, expect } from "../lib/fixtures";
import { commitAuthor, commitTitle, RepoCommit } from "../pages/repository";
import { firstDiffContentLine, firstDiffFilePath } from "../lib/diff";
import { escapeRegExp } from "../lib/regex";

test.describe("Repo Commits", () => {
  test("shows commits, auto-selects the first commit, and updates the diff when another commit is selected", async ({
    page,
  }) => {
    await page.goto("/r/empirical-run/lorem-ipsum-tests");
    await expect(page).toHaveURL(/\/r\/empirical-run\/lorem-ipsum-tests$/);
    await expect(
      page.getByRole("treeitem", { name: "package.json" }),
    ).toBeVisible();

    const repositoryViews = page.getByRole("navigation", {
      name: "Repository views",
    });
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
    await repositoryViews
      .getByRole("link", { name: "Commits", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/r\/empirical-run\/lorem-ipsum-tests\/commits$/,
    );

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
      page.getByRole("heading", { name: "Commits", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Switch branch. Current branch: ${defaultBranch}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      repositoryViews.getByRole("link", { name: "Files", exact: true }),
    ).toBeVisible();

    const commitsTable = page.getByRole("table");
    await expect(commitsTable.getByRole("columnheader")).toHaveText([
      "Commit",
      "Author",
      "Date",
    ]);
    const firstCommitLink = commitsTable.getByRole("link", {
      name: new RegExp(escapeRegExp(firstShortSha)),
    });
    const firstCommitRow = commitsTable.getByRole("row").filter({
      has: page.getByRole("link", {
        name: new RegExp(escapeRegExp(firstShortSha)),
      }),
    });
    await expect(firstCommitLink).toBeVisible();
    await expect(firstCommitLink).toContainText(commitTitle(firstCommit));
    await expect(firstCommitRow.getByRole("cell").nth(1)).toHaveText(
      commitAuthor(firstCommit),
    );
    await expect(firstCommitRow.getByRole("cell").nth(2)).toContainText(/ago/);

    const firstDiffResponsePromise = page.waitForResponse((response) => {
      if (!response.url().includes("/api/github/commit/diff")) {
        return false;
      }

      return (
        new URL(response.url()).searchParams.get("ref") === firstCommit.sha
      );
    });
    await firstCommitLink.click();

    const firstDiffResponse = await firstDiffResponsePromise;
    expect(new URL(firstDiffResponse.url()).searchParams.get("ref")).toBe(
      firstCommit.sha,
    );
    const firstDiff = (await firstDiffResponse.json()) as {
      data?: { diff?: string };
    };
    const firstDiffPath = firstDiffFilePath(firstDiff.data?.diff || "");
    const firstDiffContent = firstDiffContentLine(firstDiff.data?.diff || "");
    expect(firstDiffPath).toBeTruthy();
    expect(firstDiffContent).toBeTruthy();

    await expect(page.getByText(firstDiffPath!).first()).toBeVisible();
    await expect(
      page.getByText(new RegExp(escapeRegExp(firstDiffContent!))).first(),
    ).toBeVisible();

    await repositoryViews
      .getByRole("link", { name: "Commits", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/r\/empirical-run\/lorem-ipsum-tests\/commits$/,
    );

    const secondDiffResponsePromise = page.waitForResponse((response) => {
      if (!response.url().includes("/api/github/commit/diff")) {
        return false;
      }

      const url = new URL(response.url());
      return url.searchParams.get("ref") === secondCommit.sha;
    });

    await page
      .getByRole("link", { name: new RegExp(escapeRegExp(secondShortSha)) })
      .click();

    const secondDiffResponse = await secondDiffResponsePromise;
    const secondDiff = (await secondDiffResponse.json()) as {
      data?: { diff?: string };
    };
    const secondDiffPath = firstDiffFilePath(secondDiff.data?.diff || "");
    const secondDiffContent = firstDiffContentLine(secondDiff.data?.diff || "");
    expect(secondDiffPath).toBeTruthy();
    expect(secondDiffContent).toBeTruthy();

    await expect(page.getByText(secondDiffPath!).first()).toBeVisible();
    await expect(
      page.getByText(new RegExp(escapeRegExp(secondDiffContent!))).first(),
    ).toBeVisible();

    await repositoryViews
      .getByRole("link", { name: "Commits", exact: true })
      .click();
    await expect(page).toHaveURL(
      /\/r\/empirical-run\/lorem-ipsum-tests\/commits$/,
    );

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

    // The shared staging repo can receive new commits while this test is running,
    // which may make GitHub's page-based pagination overlap by a commit or two.
    // Pick a commit from page 2 that was not already in the page 1 response so the
    // assertion still verifies newly loaded content and stays strict-mode safe.
    const firstNewCommit = nextPageCommits.find(
      (nextPageCommit) =>
        !commits.some((commit) => commit.sha === nextPageCommit.sha),
    );
    expect(firstNewCommit).toBeDefined();
    await expect(
      page.getByRole("link", {
        name: new RegExp(escapeRegExp(firstNewCommit!.sha.slice(0, 7))),
      }),
    ).toBeVisible();

    await repositoryViews
      .getByRole("link", { name: "Files", exact: true })
      .click();
    await expect(page).toHaveURL(/\/r\/empirical-run\/lorem-ipsum-tests$/);
    await expect(
      page.getByRole("treeitem", { name: "package.json" }),
    ).toBeVisible();
  });
});
