import { type Page } from "@playwright/test";
import { expect } from "../fixtures";

export async function waitForExcalidrawScene(page: Page) {
  // The static canvas contains the drawing, unlike the interactive cursor layer.
  const canvas = page.locator("canvas.excalidraw__canvas.static");
  await expect(canvas).toBeVisible();
  // A mounted canvas and an absent loading message can precede room initialization.
  // Require actual painted content before taking the one-shot visual screenshot.
  await expect
    .poll(
      () =>
        canvas.evaluate((element: HTMLCanvasElement) => {
          const { width, height } = element;
          const pixels = element
            .getContext("2d")!
            .getImageData(0, 0, width, height).data;
          const background = pixels.slice(0, 4);
          return pixels.some((value, index) => value !== background[index % 4]);
        }),
      {
        timeout: 30_000,
        message: "Joined Excalidraw scene has painted content",
      },
    )
    .toBe(true);
  await expect(page.locator(".LoadingMessage-text")).toBeHidden({
    timeout: 30_000,
  });
}
