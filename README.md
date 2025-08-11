# flash-tests

This repo contains Playwright tests for dash.empirical.run. These tests are written and maintained by Empirical's AI agents.

[Chat with us](https://empirical.run) to have them test your app.

## Setup

### Environment Variables

1. Copy the example environment file:
   ```sh
   cp .env.example .env.local
   ```

2. Fill in the required values in `.env.local`:
   - `VERCEL_AUTOMATION_BYPASS_SECRET` - Required for bypassing Vercel protection
   - `AUTOMATED_USER_EMAIL` and `AUTOMATED_USER_PASSWORD` - Test user credentials
   - `GOOGLE_LOGIN_*` - Google credentials for magic link tests
   - `BUILD_URL` - Optional, defaults to production URL

### Install Dependencies

```sh
npm install
npm run install:browsers
```

## Usage

```sh
npm test
```
