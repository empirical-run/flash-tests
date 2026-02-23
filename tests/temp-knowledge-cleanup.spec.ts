import { test } from "./fixtures";

// Temporary cleanup test - delete after use
test("cleanup orphaned test-knowledge files", async ({ page }) => {
  const baseUrl = process.env.BUILD_URL || "https://dash.empirical.run";

  // Get the full list of knowledge files
  const listResponse = await page.request.get(`${baseUrl}/api/github/knowledge-files?repo=lorem-ipsum-tests&ref=staging`);
  const listData = await listResponse.json();
  const files: Array<{ name: string; path: string }> = listData.data.files;

  // Filter only the test-knowledge files we want to delete
  const testFiles = files.filter((f) => f.name.startsWith("test-knowledge-"));

  console.log("Orphaned test files to delete:", testFiles.map((f) => f.name));

  for (const file of testFiles) {
    // Get the SHA for this file
    const fileResponse = await page.request.get(
      `${baseUrl}/api/github/files?repo=lorem-ipsum-tests&path=${encodeURIComponent(file.path)}&ref=staging`
    );
    const fileData = await fileResponse.json();
    const sha = fileData.data.fileContents.sha;

    console.log(`Deleting ${file.name} (sha: ${sha})`);

    // Delete the file
    const deleteResponse = await page.request.delete(`${baseUrl}/api/github/files`, {
      headers: { "Content-Type": "application/json" },
      data: {
        repo: "lorem-ipsum-tests",
        path: file.path,
        sha,
      },
    });

    console.log(`Delete status for ${file.name}: ${deleteResponse.status()}`);
  }

  console.log("Cleanup complete.");
});
