import { test, expect } from "@playwright/test";
import {
  failedTraceStepIds,
  getTraceStepResult,
  traceStepResults,
} from "../pages/trace-steps";

// Local DOM contract controls: no application state or authentication needed.
test.use({ storageState: { cookies: [], origins: [] } });
const archiveUrl = "https://artifacts.example/seeded-search/trace.zip";
const stepList = `pw:api@40 Navigate /
expect@52 Expect "not toBeVisible" getByText('Showing 1 of 6 scenarios') FAILED: Error: still visible`;
const jsonSteps = JSON.stringify([
  { callId: "pw:api@40", apiName: "Navigate /" },
  {
    callId: "expect@52",
    apiName: 'Expect "not toBeVisible" Showing 1 of 6 scenarios',
    error: "Error: still visible",
  },
]);

function call(url: string, output: string): string {
  // Match the app's marker-parent + lazily mounted inline-details structure.
  return `<div><button data-testid="used-bash"
    onclick="this.insertAdjacentHTML('afterend', this.nextElementSibling.innerHTML); this.onclick=null">
    Used bash: trace-utils steps --file…</button><template>
    <div data-testid="inline-tool-details"><section><h4>Input</h4><pre>trace-utils steps --file '${url}' --json</pre></section>
    <section><h4>Output</h4><pre>${output.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre></section></div>
    </template></div>`;
}

function completedTurn(tools: string, grouped: boolean): string {
  return grouped
    ? `<button aria-expanded="false" onclick="this.setAttribute('aria-expanded','true'); this.nextElementSibling.hidden=false">Used 4 tools</button><div hidden>${tools}</div>`
    : tools;
}

test.describe("Trace steps result selection", () => {
  for (const control of [
    {
      name: "standalone text steps",
      output: stepList,
      grouped: false,
      failedSteps: ["expect@52"],
    },
    {
      name: "grouped JSON steps",
      output: jsonSteps,
      grouped: true,
      failedSteps: ["expect@52"],
    },
    {
      name: "grouped failed action steps",
      output:
        "[test.step@45] locator.click Search scenarios [FAILED]\n[pw:api@46] Click search textbox [FAILED]",
      grouped: true,
      failedSteps: ["test.step@45", "pw:api@46"],
    },
  ]) {
    test(`selects ${control.name}, not a later array-summary probe`, async ({
      page,
    }) => {
      const tools =
        call("https://artifacts.example/wrong/trace.zip", stepList) +
        call(archiveUrl, "pw:api@40 Navigate /") +
        call(archiveUrl, control.output) +
        call(archiveUrl, "type array 45");
      await page.setContent(
        `<div id="earlier">${call(archiveUrl, stepList)}</div><div id="response">${completedTurn(tools, control.grouped)}</div>`,
      );
      const response = page.locator("#response");
      const { input, output } = await getTraceStepResult(response, archiveUrl);
      await expect(input).toContainText(archiveUrl);
      await expect(output).toContainText(control.failedSteps[0]);
      expect(failedTraceStepIds(await output.innerText())).toEqual(
        control.failedSteps,
      );
      await expect(traceStepResults(response, archiveUrl)).toHaveCount(1);
      await expect(
        response.getByTestId("inline-tool-details").last(),
      ).toContainText("type array 45");
      await expect(
        page.locator("#earlier").getByTestId("inline-tool-details"),
      ).toHaveCount(0);
    });
  }

  test("summary-only output and prose cannot qualify as step execution", async ({
    page,
  }) => {
    await page.setContent(`<div id="response">${call(archiveUrl, "type array 45")}
      <div class="prose">Failing step: expect@52, Before Hooks, fixture, pw:api</div></div>`);
    await page.getByTestId("used-bash").click();
    await expect(
      traceStepResults(page.locator("#response"), archiveUrl),
    ).toHaveCount(0);
    expect(() => failedTraceStepIds("type array 45")).toThrow();
    expect(() =>
      failedTraceStepIds(
        JSON.stringify({
          callId: "expect@48",
          apiName: "Expect not toBeVisible",
          error: null,
        }),
      ),
    ).toThrow();
    expect(() =>
      failedTraceStepIds(
        JSON.stringify({
          callId: "expect@48",
          apiName: "Expect not toBeVisible",
          error: "",
        }),
      ),
    ).toThrow();
    expect(
      failedTraceStepIds(
        "expect@48 Expect not toBeVisible\npw:api@53 FAILED: Error: unrelated",
      ),
    ).toEqual(["pw:api@53"]);
    expect(() =>
      failedTraceStepIds(
        "fixture@48 Fixture page FAILED: Error: no action steps",
      ),
    ).toThrow();
  });
});
