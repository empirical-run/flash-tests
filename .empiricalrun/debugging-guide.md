# Playwright Test Debugging Guide

This document captures learnings and best practices for debugging Playwright test failures, especially for tool execution and session-based tests.

## Tool Execution Test Debugging Process

### When You See: "Timed out waiting for expect(locator).toBeVisible()"

**Don't assume the feature is broken immediately.** The timeout might be too short for the actual operation.

### Step-by-Step Debugging Process

1. **Check the Original Error Context**
   - Look at the page snapshot in the test report
   - Check what UI state the page was in when it timed out
   - Note any "Running" or "Thinking" indicators

2. **Use Browser Agent to Investigate Live State**
   ```typescript
   // Add investigation test with TODO for browser agent
   test('investigate session status', async ({ page }) => {
     await page.goto('/');
     // TODO(agent on page): Navigate to Sessions, find session #XXXX and check current status
   });
   ```

3. **Key Things Browser Agent Should Check**
   - Navigate to the relevant page (Sessions, specific session)
   - Look for completion indicators ("Used" vs "Running")
   - Check if results are visible
   - Note actual timing information displayed in UI

4. **Common Findings**
   - Tool execution completed but took longer than test timeout
   - UI status text patterns may have changed ("Used" vs other completion indicators)
   - Results are present but test is looking for wrong completion signal

### Tool Execution Specific Patterns

#### What to Look For:
- **Running State**: "Running str_replace_based_edit_tool: view tool — XX secs ago"
- **Completed State**: "Used str_replace_based_edit_tool: view tool — in X mins Y secs"
- **Results**: Actual tool output (like file listings, API responses)

#### Common Issues:
1. **Timeout Too Short**: Tool execution takes 3-5 minutes but test waits only 45 seconds
2. **Wrong Completion Indicator**: Test looks for "Used" text but UI pattern changed
3. **Missing page.goto('/')**: Test starts without navigating to app

### Browser Agent Best Practices

1. **Always start with `await page.goto('/')`** in investigation tests
2. **Use specific build URLs** when provided for consistency
3. **Look for actual data/results** rather than just status text
4. **Check timing information** displayed in UI to understand real execution time

### Test Fixes

#### Option 1: Increase Timeout
```typescript
// Instead of 45 seconds
await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 45000 });

// Use longer timeout based on investigation findings
await expect(page.getByText("Used str_replace_based_edit_tool: view tool")).toBeVisible({ timeout: 300000 }); // 5 minutes
```

#### Option 2: Wait for Results Instead of Status
```typescript
// More reliable - wait for actual tool results
await expect(page.getByText("package.json")).toBeVisible({ timeout: 300000 });
```

#### Option 3: Wait for Running State to Disappear
```typescript
// Wait for completion by checking running state disappears
await expect(page.getByText("Running str_replace_based_edit_tool: view tool")).not.toBeVisible({ timeout: 300000 });
```

## Key Learnings

1. **Don't assume app issues from timeout errors** - investigate actual completion time first
2. **Use browser agent proactively** - it can access live state that test reports can't show
3. **Focus on results over status text** - status text can change but results are more reliable
4. **Always include proper navigation** - missing `page.goto('/')` is a common issue
5. **Tool execution can take minutes, not seconds** - plan timeouts accordingly

## Investigation Template

When debugging similar issues:

```typescript
test('investigate [feature] status', async ({ page }) => {
  await page.goto('/');
  // TODO(agent on page): Navigate to [relevant page], find [specific item] and check:
  // 1. Current status/state
  // 2. Any completion indicators
  // 3. Actual results/data present
  // 4. Timing information if available
});
```

## Tools and Commands

- `fetchDiagnosisDetails()` - Get detailed test failure information
- `generateTestWithBrowserAgent()` - Use browser to investigate live state
- `str_replace_based_edit_tool` - Modify test files
- Browser agent with specific build URLs for consistency

---

*Last updated: [Current Date] - Add new patterns and learnings as they're discovered*