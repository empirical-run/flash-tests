import { test, expect } from "./fixtures";
import { slowDrag } from "./pages/mouse";

test.describe("Excalidraw", () => {
  test("draw a rectangle and type text in it", async ({ page, context }) => {
    // 1. Go to excalidraw.com
    await page.goto("https://excalidraw.com/");

    // 2. Select rectangle tool using keyboard shortcut (R or 2)
    await page.keyboard.press("r");

    // 3. Use coordinates to click, drag and create the box with slow dragging (20px at a time)
    const startX = 400;
    const startY = 300;
    const endX = 600;
    const endY = 450;

    await slowDrag(page, startX, startY, endX, endY, 20);

    // 4. Click at the center of the rectangle and type "hello world"
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;

    // Double-click to enter text editing mode
    await page.mouse.dblclick(centerX, centerY);

    // Type the text
    await page.keyboard.type("hello world");

    // Press Escape to exit text editing mode
    await page.keyboard.press("Escape");

    // Click outside to deselect
    await page.mouse.click(100, 100);

    // 5. Click "Share", get a new link, and open the page in a new tab
    await page
      .getByRole("button", { name: "Live collaboration..." })
      .click();

    // Click on "Start session" to create a live collaboration session (generates a shareable URL)
    await page.getByRole("button", { name: "Start session" }).click();

    // Wait for the session to start and URL to update with room ID
    await expect(page).toHaveURL(/room/);

    // Get the shareable link from the current URL
    const shareLink = page.url();

    // Open the link in a new tab
    const newPage = await context.newPage();
    await newPage.goto(shareLink);

    // Wait for 5 seconds on the new page
    await newPage.waitForTimeout(5000);

    // Verify the drawing is visible on the new page (the canvas should have content)
    await expect(newPage.locator("canvas").first()).toBeVisible();

    // Visual assertion to verify the drawing looks correct
    await expect(newPage).toLookRight(
      "An Excalidraw canvas showing a hand-drawn style rectangle with the text 'hello world' inside it",
    );
  });
});
