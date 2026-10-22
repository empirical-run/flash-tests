import { test, expect } from "../fixtures";
import {
  openNewSessionDialog,
  submitNewSessionDialog,
} from "../pages/sessions";

test.describe("Mobile Session Tests", () => {
  test("create new session and send chat message", async ({
    page,
    trackCurrentSession,
  }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto("/");

    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width

    // Navigate directly to Sessions. The new mobile shell no longer exposes the
    // old sidebar trigger; primary navigation is behind the Menu control.
    await page.goto("/sessions");
    await expect(page).toHaveURL(/sessions$/);

    // Create a new session with initial prompt
    await openNewSessionDialog(page);
    const chatMessage = "hi there";
    await submitNewSessionDialog(page, chatMessage);

    // Track the session for automatic cleanup
    trackCurrentSession(page);

    // Verify the initial chat message appears in the conversation
    await expect(page.getByText(chatMessage).first()).toBeVisible();

    // Note: Details tab and Close Session functionality not available in mobile interface
    // Mobile UI likely has different session management approach
  });
});
