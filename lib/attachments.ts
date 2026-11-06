import { writeFileSync } from "fs";
import { Locator, TestInfo } from "@playwright/test";

export async function attachCliOutput(
  testInfo: TestInfo,
  name: string,
  output: string,
) {
  const path = testInfo.outputPath(`${name}.txt`);
  writeFileSync(path, output);
  await testInfo.attach(name, { path, contentType: "text/plain" });
}

export async function attachDialogScreenshot(
  dialog: Locator,
  testInfo: TestInfo,
  name: string,
) {
  const path = testInfo.outputPath(`${name}.png`);
  await dialog.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}
