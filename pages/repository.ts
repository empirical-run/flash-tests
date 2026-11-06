import type { Page } from "@playwright/test";

export const branchPicker = (page: Page) =>
  page.getByRole("button", {
    name: /^Switch branch\. Current branch:/,
  });

export type RepoCommit = {
  sha: string;
  author: { login: string } | null;
  commit: {
    author: {
      name: string;
    };
    message: string;
  };
};

export function commitTitle(commit: RepoCommit) {
  return commit.commit.message.split("\n")[0] || "Untitled commit";
}

export function commitAuthor(commit: RepoCommit) {
  return commit.author?.login || commit.commit.author.name;
}
