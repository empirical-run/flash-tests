import type { Page } from "@playwright/test";

const DEFAULT_DASHBOARD_BASE_URL = "https://dash.empirical.run";
const DEFAULT_PRODUCTION_API_BASE_URL = "https://api.empirical.run";
const DEFAULT_PREVIEW_API_BASE_URL = "https://api-preview.empirical.run";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export function getTestRunEnvironment(): string {
  // ENV_SLUG is the Empirical runner's canonical environment selector; when
  // TEST_RUN_ENVIRONMENT is not present, it is still safe to use it for choosing
  // environment-specific service URLs.
  return (
    process.env.TEST_RUN_ENVIRONMENT ||
    process.env.ENV_SLUG ||
    "production"
  ).toLowerCase();
}

export function isPreviewEnvironment(): boolean {
  return getTestRunEnvironment() === "preview";
}

export function getDashboardBaseUrl(): string {
  return stripTrailingSlash(
    process.env.BUILD_URL || DEFAULT_DASHBOARD_BASE_URL,
  );
}

export function getCurrentPageOrigin(page: Page): string {
  return new URL(page.url()).origin;
}

export function getApiBaseUrl(): string {
  if (process.env.API_BASE_URL) {
    return stripTrailingSlash(process.env.API_BASE_URL);
  }

  return isPreviewEnvironment()
    ? DEFAULT_PREVIEW_API_BASE_URL
    : DEFAULT_PRODUCTION_API_BASE_URL;
}
