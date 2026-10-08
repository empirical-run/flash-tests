# flash-tests

This repo contains Playwright tests for empirical.run. These tests are written and maintained by Empirical's AI agents.

[Chat with us](https://empirical.run) to have them test your app.

## Usage

```sh
npm test
```

## API-key maintenance

Ordinary runs exercise real, ID-owned cleanup and leave other scenarios' keys
alone. The broad accumulated-key sweep is **opt-in**:

```sh
API_KEYS_MAINTENANCE=1 ENV_SLUG=preview npx playwright test \
  tests/temp-api-keys-cleanup.spec.ts -g "cleanup accumulated"
```

The sweep only deletes non-internal keys with known test-name prefixes and a
valid server `created_at` at least **24 hours old**. It freezes the cutoff at
start, so new keys from overlapping runs cannot become eligible. Do not enable
broad prefix-only cleanup or remove the age fence: different full runs share the
same project and can create keys while maintenance is running.

Normal tests clean up only IDs returned by their own creation requests. No
serial mode, worker cap, or suite-wide concurrency lock is required.
