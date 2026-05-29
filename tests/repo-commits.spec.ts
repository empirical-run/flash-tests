import { test, expect } from "./fixtures";

const FIRST_COMMIT = {
  sha: "1111111222222233333334444444555555566666",
  shortSha: "1111111",
  title: "Add deterministic commits page fixture",
  author: "Empirical Bot",
  date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
};

const SECOND_COMMIT = {
  sha: "aaaaaaabbbbbbbcccccccdddddddeeeeeeeffffff",
  shortSha: "aaaaaaa",
  title: "Update dashboard commits diff panel",
  author: "Dashboard Tester",
  date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
};

const LOAD_MORE_COMMIT = {
  sha: "9999999888888877777776666666555555544444",
  shortSha: "9999999",
  title: "Older repository commit",
  author: "Empirical Bot",
  date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
};

function toRepoCommit(commit: typeof FIRST_COMMIT) {
  return {
    sha: commit.sha,
    html_url: `https://github.com/empirical-run/lorem-ipsum-tests/commit/${commit.sha}`,
    author: {
      login: commit.author,
      avatar_url: "https://github.com/identicons/empirical.png",
      html_url: "https://github.com/empirical-run",
    },
    committer: null,
    commit: {
      author: {
        name: commit.author,
        email: "automation-test@example.com",
        date: commit.date,
      },
      committer: {
        name: commit.author,
        email: "automation-test@example.com",
        date: commit.date,
      },
      message: `${commit.title}\n\nMocked by the Playwright commits page test`,
    },
    parents: [],
  };
}

const firstPageCommits = [
  FIRST_COMMIT,
  SECOND_COMMIT,
  ...Array.from({ length: 48 }, (_, index) => ({
    sha: `${String(index).padStart(7, "0")}feedfeedfeedfeedfeedfeedfeedfeedf`,
    shortSha: String(index).padStart(7, "0"),
    title: `Filler commit ${index + 1}`,
    author: "Empirical Bot",
    date: new Date(Date.now() - (index + 3) * 60 * 60 * 1000).toISOString(),
  })),
];

const diffBySha: Record<string, string> = {
  [FIRST_COMMIT.sha]: `diff --git a/README.md b/README.md
index 83db48f..f735c2d 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,2 @@
-Old README title
+First mocked commit diff line
 Repository fixture
`,
  [SECOND_COMMIT.sha]: `diff --git a/tests/commits.spec.ts b/tests/commits.spec.ts
index e69de29..0c3f6a1 100644
--- a/tests/commits.spec.ts
+++ b/tests/commits.spec.ts
@@ -0,0 +1,2 @@
+Second mocked commit diff line
+Selected commit changed
`,
  [LOAD_MORE_COMMIT.sha]: `diff --git a/older.txt b/older.txt
new file mode 100644
index 0000000..81fcd55
--- /dev/null
+++ b/older.txt
@@ -0,0 +1 @@
+Older commit diff
`,
};

test.describe("Repo Commits", () => {
  test("shows commits, auto-selects the first commit, and updates the diff when another commit is selected", async ({ page }) => {
    await page.route("**/api/github/proxy", async (route, request) => {
      const body = request.postDataJSON() as { url?: string };

      if (!body.url?.includes("/commits?")) {
        await route.continue();
        return;
      }

      const githubUrl = new URL(body.url, "https://github.test");
      const pageNumber = githubUrl.searchParams.get("page");
      const commits = pageNumber === "2" ? [LOAD_MORE_COMMIT] : firstPageCommits;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(commits.map(toRepoCommit)),
      });
    });

    await page.route("**/api/github/commit/diff?**", async (route, request) => {
      const url = new URL(request.url());
      const ref = url.searchParams.get("ref")!;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { diff: diffBySha[ref] } }),
      });
    });

    await page.goto("/");
    await page.getByRole("link", { name: "Repository" }).click();
    await expect(page).toHaveURL(/\/repo$/);

    const repoUrl = new URL(page.url());
    await page.goto(`${repoUrl.pathname}/commits`);
    await expect(page).toHaveURL(/\/repo\/commits$/);

    await expect(page.getByRole("link", { name: "Repository" }).nth(1)).toBeVisible();
    await expect(page.getByText("Commits", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("staging", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Files" })).toBeVisible();

    await expect(page.getByRole("button", { name: new RegExp(FIRST_COMMIT.title) })).toBeVisible();
    await expect(page.getByText(FIRST_COMMIT.author, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(FIRST_COMMIT.shortSha, { exact: true })).toBeVisible();
    await expect(page.getByText(/ago/).first()).toBeVisible();

    await expect(page.getByText(FIRST_COMMIT.sha, { exact: true })).toBeVisible();
    await expect(page.getByText("README.md").first()).toBeVisible();
    await expect(page.getByText("First mocked commit diff line")).toBeVisible();

    await page.getByRole("button", { name: new RegExp(SECOND_COMMIT.title) }).click();
    await expect(page.getByText(SECOND_COMMIT.sha, { exact: true })).toBeVisible();
    await expect(page.getByText(FIRST_COMMIT.sha, { exact: true })).not.toBeVisible();
    await expect(page.getByText("tests/commits.spec.ts").first()).toBeVisible();
    await expect(page.getByText("Second mocked commit diff line")).toBeVisible();

    await page.getByRole("button", { name: "Load more" }).click();
    await expect(page.getByRole("button", { name: new RegExp(LOAD_MORE_COMMIT.title) })).toBeVisible();
    await expect(page.getByText("End of history")).toBeVisible();

    await page.getByRole("link", { name: "Files" }).click();
    await expect(page).toHaveURL(/\/repo$/);
  });
});
