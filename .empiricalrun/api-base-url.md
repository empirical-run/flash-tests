# API base URL convention for tests

For all API calls made inside tests, always use `https://api.empirical.run`.

- Do not point API calls at environment-specific hosts (e.g. `api-preview.empirical.run`) for new tests.
- When a helper is available, prefer the shared helper in `tests/pages/urls.ts`, but ensure it resolves to `https://api.empirical.run`.
