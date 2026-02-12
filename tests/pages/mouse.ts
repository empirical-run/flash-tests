import { Page } from "@playwright/test";

/**
 * Performs a slow drag operation from start coordinates to end coordinates
 * with incremental steps.
 *
 * @param page - The Playwright page object
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param endX - Ending X coordinate
 * @param endY - Ending Y coordinate
 * @param stepSize - Size of each step in pixels (default: 20)
 */
export async function slowDrag(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  stepSize: number = 20,
): Promise<void> {
  // Move to start position and press mouse down
  await page.mouse.move(startX, startY);
  await page.mouse.down();

  // Drag slowly in incremental steps
  let currentX = startX;
  let currentY = startY;

  while (currentX !== endX || currentY !== endY) {
    if (currentX < endX) {
      currentX = Math.min(currentX + stepSize, endX);
    } else if (currentX > endX) {
      currentX = Math.max(currentX - stepSize, endX);
    }

    if (currentY < endY) {
      currentY = Math.min(currentY + stepSize, endY);
    } else if (currentY > endY) {
      currentY = Math.max(currentY - stepSize, endY);
    }

    await page.mouse.move(currentX, currentY);
  }

  // Release mouse
  await page.mouse.up();
}
