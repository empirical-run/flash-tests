# Debugging Test Timeouts with Browser Agent

## The Problem
When you see "Timed out waiting for expect(locator).toBeVisible()", don't assume the feature is broken. The operation might just take longer than the test timeout.

## The Solution: Use Browser Agent to Investigate

### Step 1: Add Investigation Test
```typescript
test('investigate [feature] status', async ({ page }) => {
  await page.goto('/');
  // TODO(agent on page): Navigate to [page], find [item] and check current status and results
});
```

### Step 2: Run Browser Agent
Use `generateTestWithBrowserAgent()` with the specific build URL to check the live state of the application.

### Step 3: Analyze Findings
- Check if operation actually completed (look for results, not just status text)
- Note actual timing (e.g., "completed in 3 mins 48 secs" vs 45-second test timeout)
- Look for completion indicators in UI

## Example: Tool Execution Timeout

**Original Error**: Test waiting for "Used str_replace_based_edit_tool: view tool" timed out after 45 seconds

**Browser Agent Investigation**: Found the tool actually completed successfully in 3+ minutes with visible results

**Root Cause**: Test timeout too short, not app failure

## Key Rules

1. **Always start with `await page.goto('/')`** in investigation tests
2. **Use single-line TODO comments** for browser agent
3. **Look for actual results/data** rather than status text
4. **Check timing information** in UI to set appropriate timeouts