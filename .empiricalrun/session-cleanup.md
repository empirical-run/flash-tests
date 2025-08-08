# Session Cleanup Guide

## Overview

This guide explains how to properly handle session cleanup in Playwright tests to ensure sessions are automatically closed after each test completes.

## Automatic Cleanup System

### Implementation

The automatic session cleanup is implemented in `tests/fixtures.ts` using:
- **SessionTracker class**: Tracks session IDs during test execution
- **trackCurrentSession fixture**: Helper function to register sessions
- **afterEach hook**: Automatically calls `/api/sessions/{sessionId}/close` for each tracked session

### Benefits

- ✅ **Reliability**: Sessions are closed even if tests fail before manual cleanup
- ✅ **Cleaner code**: No need for repetitive manual cleanup in each test
- ✅ **Better resource management**: Prevents accumulation of unclosed sessions
- ✅ **Backwards compatible**: Works alongside existing manual cleanup code

## Usage Pattern

### 1. Test Function Signature

Update your test function to include the `trackCurrentSession` fixture:

```typescript
test('your test name', async ({ page, trackCurrentSession }) => {
  // test code here
});
```

### 2. Session Creation and Tracking

After creating a session, add tracking:

```typescript
// Create a new session
await page.getByRole('button', { name: 'New' }).click();
await page.getByRole('button', { name: 'Create' }).click();

// Verify we're in a session
await expect(page).toHaveURL(/sessions/, { timeout: 10000 });

// Track the session for automatic cleanup
trackCurrentSession(page);

// Continue with your test...
```

### 3. Remove Manual Cleanup

Remove manual cleanup code from tests (except UI testing scenarios):

```typescript
// ❌ Remove these lines (handled automatically):
// await page.getByRole('tab', { name: 'Details', exact: true }).click();
// await page.getByRole('button', { name: 'Close Session' }).click();
// await page.getByRole('button', { name: 'Confirm' }).click();
```

## Special Cases

### Tests That Test Close Functionality

For tests that specifically test the session close UI functionality, keep the manual cleanup:

```typescript
test('Close session and verify session state', async ({ page, trackCurrentSession }) => {
  // Create session
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  
  // Track session (as backup cleanup)
  trackCurrentSession(page);
  
  // Test the close functionality via UI
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await page.getByRole('button', { name: 'Close Session' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  
  // Verify close behavior
  await expect(page.getByRole('button', { name: 'Session Closed', exact: true })).toBeVisible();
});
```

### Multiple Sessions in One Test

The tracker handles multiple sessions automatically:

```typescript
test('multiple sessions test', async ({ page, trackCurrentSession }) => {
  // Create first session
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
  trackCurrentSession(page);
  
  // Navigate back and create second session
  await page.goto('/sessions');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
  trackCurrentSession(page);
  
  // Both sessions will be automatically closed
});
```

## API Details

### Session Close Endpoint

The cleanup system uses the following API call:

```typescript
await page.request.post(`/api/sessions/${sessionId}/close`, {
  headers: {
    'Content-Type': 'application/json'
  }
});
```

### Error Handling

- API errors are logged as warnings but don't fail tests
- Session tracking is cleared after each test regardless of cleanup success

## Migration Checklist

When updating existing tests:

- [ ] Add `trackCurrentSession` to test function parameters
- [ ] Add `trackCurrentSession(page)` call after session creation
- [ ] Remove manual cleanup code (except for UI tests)
- [ ] Test to ensure sessions are properly cleaned up

## Files Already Updated

- ✅ `tests/sessions.spec.ts` - "stop tool execution and send new message" test
- ✅ `tests/tool-execution/session.spec.ts` - main tool execution test

## Files Still Needing Updates

- `tests/sessions.spec.ts` - remaining tests that create sessions
- `tests/tool-execution/session.spec.ts` - remaining tests
- `tests/mobile/session.spec.ts` - if it creates sessions
- `tests/onboarding/session-redirect.spec.ts` - if it creates sessions