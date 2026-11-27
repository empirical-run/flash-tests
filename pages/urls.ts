const DEFAULT_DASHBOARD_BASE_URL = "https://empirical.run";
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

export function getApiBaseUrl(): string {
  if (process.env.API_BASE_URL) {
    return stripTrailingSlash(process.env.API_BASE_URL);
  }

  return isPreviewEnvironment()
    ? DEFAULT_PREVIEW_API_BASE_URL
    : DEFAULT_PRODUCTION_API_BASE_URL;
}

/** Re-home an emailed app link onto the deployment under test, keeping path/query/hash. */
export function toDashboardUrl(href: string): string {
  const url = new URL(href);
  return `${getDashboardBaseUrl()}${url.pathname}${url.search}${url.hash}`;
}

/**
 * Routes a user without org access is sent to. Check the pathname, not the full
 * URL: preview hostnames can contain "onboarding".
 */
export function isNoOrgRoute(url: URL): boolean {
  return /^\/(?:onboarding|create-org|signup)(?:\/|$)/.test(url.pathname);
}
