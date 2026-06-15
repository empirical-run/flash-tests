# API Calls in Tests

When writing or updating Playwright tests in this repo, always use `api.empirical.run` for API calls made from tests.

Avoid introducing test API calls to alternate Empirical API hostnames unless the user explicitly asks for an exception.
