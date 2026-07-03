import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Browser, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { loginWithPassword } from "../pages/login";
import { getDashboardBaseUrl } from "../pages/urls";
import { waitForFirstMessage } from "../pages/sessions";
import { getProjectSlug } from "../pages/settings";

type CommandEnv = Record<string, string | undefined>;

const CLI_ENVIRONMENT = process.env.EMPIRICAL_CLI_AUTH_ENV ?? (process.env.TEST_RUN_ENVIRONMENT === "preview" ? "staging" : "prod");
const CLI_ENVIRONMENTS = ["prod", "staging", "local"];
const LOGIN_TIMEOUT_MS = 90_000;
const COMMAND_TIMEOUT_MS = 120_000;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const escapedCliEnvironment = escapeRegExp(CLI_ENVIRONMENT);
const CLI_LOGIN_SUCCESS_PATTERN = new RegExp(
  `Logged in to Empirical(?: CLI\\.| \\(${escapedCliEnvironment}\\)\\.?)`,
);
const CLI_LOGOUT_SUCCESS_PATTERN = new RegExp(
  `Logged out of Empirical(?: CLI)? \\(${escapedCliEnvironment}\\)\\.?`,
);

class RunningCommand {
  private readonly process: ChildProcessWithoutNullStreams;
  private output = "";
  private exitCode: number | null = null;
  private readonly exitPromise: Promise<number | null>;

  constructor(command: string, args: string[], env: CommandEnv) {
    this.process = spawn(command, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.process.stdout.on("data", (data: Buffer) => {
      this.output += data.toString();
    });
    this.process.stderr.on("data", (data: Buffer) => {
      this.output += data.toString();
    });

    this.exitPromise = new Promise((resolve) => {
      this.process.on("close", (code) => {
        this.exitCode = code;
        resolve(code);
      });
    });
  }

  getOutput() {
    return this.output;
  }

  waitForOutput(pattern: RegExp, timeoutMs = COMMAND_TIMEOUT_MS) {
    return new Promise<RegExpMatchArray>((resolve, reject) => {
      const currentMatch = this.output.match(pattern);
      if (currentMatch) {
        resolve(currentMatch);
        return;
      }

      const timeout = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `Timed out waiting for ${pattern}. Output so far:\n${this.output}`,
          ),
        );
      }, timeoutMs);

      const onData = () => {
        const match = this.output.match(pattern);
        if (match) {
          cleanup();
          resolve(match);
        }
      };

      const onClose = () => {
        const match = this.output.match(pattern);
        cleanup();
        if (match) {
          resolve(match);
          return;
        }
        reject(
          new Error(
            `Process exited before ${pattern} appeared. Output:\n${this.output}`,
          ),
        );
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.process.stdout.off("data", onData);
        this.process.stderr.off("data", onData);
        this.process.off("close", onClose);
      };

      this.process.stdout.on("data", onData);
      this.process.stderr.on("data", onData);
      this.process.on("close", onClose);
    });
  }

  async waitForExit(timeoutMs = COMMAND_TIMEOUT_MS) {
    if (this.exitCode !== null) {
      return this.exitCode;
    }

    return Promise.race([
      this.exitPromise,
      new Promise<number>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `Timed out waiting for process to exit. Output so far:\n${this.output}`,
            ),
          );
        }, timeoutMs);
      }),
    ]);
  }

  kill() {
    if (this.exitCode === null) {
      this.process.kill();
    }
  }
}

async function runCommand(
  command: string,
  args: string[],
  env: CommandEnv,
  timeoutMs = COMMAND_TIMEOUT_MS,
) {
  const runningCommand = new RunningCommand(command, args, env);
  const exitCode = await runningCommand.waitForExit(timeoutMs);
  const output = runningCommand.getOutput();
  expect(
    output,
    `${command} ${args.join(" ")} should exit successfully`,
  ).toBeTruthy();
  expect(exitCode, output).toBe(0);
  return output;
}

function cliEnv(home: string): CommandEnv {
  if (!CLI_ENVIRONMENTS.includes(CLI_ENVIRONMENT)) {
    throw new Error("EMPIRICAL_CLI_AUTH_ENV must be prod, staging, or local");
  }

  return {
    ...process.env,
    HOME: home,
    CI: "true",
    EMPIRICAL_CONFIGURE_SKILL: "no",
    EMPIRICAL_ENV: CLI_ENVIRONMENT,
    EMPIRICAL_DASHBOARD_URL: getDashboardBaseUrl(),
  };
}

async function resolveAuthorizationUrlForBrowser(page: Page, authorizationUrl: string) {
  const authorizationResponse = await page.request.get(authorizationUrl, {
    maxRedirects: 0,
  });
  const location = authorizationResponse.headers().location;

  if (location) {
    const redirectUrl = new URL(location);
    if (redirectUrl.hostname === "localhost" && redirectUrl.port === "3000") {
      const buildUrl = new URL(getDashboardBaseUrl());
      redirectUrl.protocol = buildUrl.protocol;
      redirectUrl.hostname = buildUrl.hostname;
      redirectUrl.port = buildUrl.port;
    }
    return redirectUrl.toString();
  }

  return authorizationUrl;
}

async function signInAndAuthorizeCli(page: Page, authorizationUrl: string) {
  await page.goto(await resolveAuthorizationUrlForBrowser(page, authorizationUrl));

  await loginWithPassword(page);

  const authorizeButton = page.getByRole("button", { name: "Authorize" });
  const authorizedHeading = page.getByText("Empirical CLI authorized");

  // The automated account may have already authorized this OAuth client. In that
  // case the app redirects directly to the CLI callback page without showing the
  // consent form again.
  await expect(authorizeButton.or(authorizedHeading)).toBeVisible();
  if (await authorizeButton.isVisible()) {
    await expect(
      page.getByRole("heading", { name: "Authorize Application" }),
    ).toBeVisible();
    await authorizeButton.click();
  }

  await expect(page).toHaveURL(/http:\/\/127\.0\.0\.1:14538\/oauth\/callback/);
  await expect(authorizedHeading).toBeVisible();
  await expect(
    page.getByText("You can close this tab and return to your terminal."),
  ).toBeVisible();
}

async function newUnauthenticatedPage(browser: Browser) {
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  return { context, page };
}

test.describe("Empirical CLI install and login", () => {
  // Tests share a single installed + logged-in CLI, so they must run in order:
  // install/login first, then the session command, then logout.
  test.describe.configure({ mode: "serial" });

  test.skip(
    process.env.TEST_RUN_ENVIRONMENT === "preview" || process.env.ENV_SLUG === "preview",
    "CLI OAuth origins are not authorized for preview builds.",
  );

  // Shared across the serial tests below.
  let home: string;
  let binaryPath: string;

  test.afterAll(() => {
    if (home) {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test("new user can install the CLI, log in, and verify identity", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);

    expect(
      process.env.AUTOMATED_USER_EMAIL,
      "AUTOMATED_USER_EMAIL is required for CLI OAuth login",
    ).toBeTruthy();
    expect(
      process.env.AUTOMATED_USER_PASSWORD,
      "AUTOMATED_USER_PASSWORD is required for CLI OAuth login",
    ).toBeTruthy();

    home = mkdtempSync(join(tmpdir(), "empirical-cli-home-"));
    let loginCommand: RunningCommand | undefined;

    try {
      const env = cliEnv(home);
      binaryPath = join(home, ".empirical", "bin", "empirical");

      const installOutput = await runCommand(
        "sh",
        ["-c", "curl -fsSL https://cli.empirical.run/install | sh"],
        env,
        180_000,
      );
      await testInfo.attach("install-output", {
        body: installOutput,
        contentType: "text/plain",
      });
      expect(installOutput).toMatch(
        /Downloading from https:\/\/cli\.empirical\.run\/(?:latest|\d+\.\d+\.\d+)\/empirical-(darwin|linux)-(arm64|x64)\.(?:gz|tgz)\.\.\./,
      );
      expect(installOutput).toMatch(/Installed empirical \d+\.\d+\.\d+/);
      expect(installOutput).toContain("PATH setup");
      const shellStartupFilePattern = "\\.(?:bash_profile|bashrc|profile|zprofile|zshrc)";
      expect(installOutput).toMatch(
        new RegExp(
          `Added ${escapeRegExp(join(home, ".empirical", "bin"))} to PATH \\(${escapeRegExp(home)}/${shellStartupFilePattern}\\)`,
        ),
      );
      expect(installOutput).toContain("Next steps");
      // The installer now configures PATH immediately, so the next steps focus on
      // sourcing the updated shell file rather than a separate login instruction.
      expect(installOutput).toMatch(
        new RegExp(
          `source "\\$HOME/${shellStartupFilePattern}"\\s+Run this \\(or open a new terminal\\) to use empirical now`,
        ),
      );
      expect(installOutput).toMatch(
        /empirical skill install --global\s+Teach your coding agents to use Empirical/,
      );
      expect(
        existsSync(binaryPath),
        "installer writes the standalone binary to ~/.empirical/bin/empirical",
      ).toBe(true);
      expect(statSync(binaryPath).isFile()).toBe(true);

      const versionOutput = await runCommand(binaryPath, ["version"], env);
      await testInfo.attach("version-output", {
        body: versionOutput,
        contentType: "text/plain",
      });
      expect(versionOutput).toMatch(/^\d+\.\d+\.\d+/m);

      loginCommand = new RunningCommand(binaryPath, ["login"], env);
      const loginUrlMatch = await loginCommand.waitForOutput(
        /https?:\/\/\S+/,
        LOGIN_TIMEOUT_MS,
      );
      const loginOutputBeforeBrowser = loginCommand.getOutput();
      expect(loginOutputBeforeBrowser).toContain(
        `Opening browser for Empirical authorization (${CLI_ENVIRONMENT})...`,
      );

      const authorizationUrl = loginUrlMatch[0];
      const parsedAuthorizationUrl = new URL(authorizationUrl);
      expect(parsedAuthorizationUrl.pathname).toContain(
        "/auth/v1/oauth/authorize",
      );
      expect(parsedAuthorizationUrl.searchParams.get("response_type")).toBe(
        "code",
      );
      expect(
        parsedAuthorizationUrl.searchParams.get("code_challenge_method"),
      ).toBe("S256");
      expect(parsedAuthorizationUrl.searchParams.get("redirect_uri")).toBe(
        "http://127.0.0.1:14538/oauth/callback",
      );

      const { context, page } = await newUnauthenticatedPage(browser);
      await signInAndAuthorizeCli(page, authorizationUrl);
      await context.close();

      await loginCommand.waitForOutput(
        CLI_LOGIN_SUCCESS_PATTERN,
        LOGIN_TIMEOUT_MS,
      );
      const loginExitCode = await loginCommand.waitForExit(LOGIN_TIMEOUT_MS);
      const loginOutput = loginCommand.getOutput();
      await testInfo.attach("login-output", {
        body: loginOutput,
        contentType: "text/plain",
      });
      expect(loginExitCode, loginOutput).toBe(0);
      expect(loginOutput).toMatch(CLI_LOGIN_SUCCESS_PATTERN);

      const whoamiOutput = await runCommand(binaryPath, ["whoami"], env);
      await testInfo.attach("whoami-output", {
        body: whoamiOutput,
        contentType: "text/plain",
      });
      expect(whoamiOutput).toMatch(/user_id:\s+[0-9a-f-]{36}/i);
      expect(whoamiOutput).toContain(
        `email:   ${process.env.AUTOMATED_USER_EMAIL}`,
      );
    } finally {
      loginCommand?.kill();
    }
  });

  test("can start and continue an agent session without duplicating messages in the dashboard", async ({
    page,
    trackCurrentSession,
  }, testInfo) => {
    test.setTimeout(600_000);

    expect(
      binaryPath,
      "the install-and-login test must run before the session test",
    ).toBeTruthy();

    const env = cliEnv(home);
    const firstPrompt = "say 'pong' and nothing else in your response";
    const secondPrompt = "what is 2+2";

    // Start a brand-new session and wait for the agent's response with -x.
    const startOutput = await runCommand(
      binaryPath,
      ["session", "-x", "-p", getProjectSlug(), firstPrompt],
      env,
      300_000,
    );
    await testInfo.attach("session-start-output", {
      body: startOutput,
      contentType: "text/plain",
    });
    expect(startOutput.toLowerCase()).toContain("pong");

    // The CLI prints a continuation hint that includes the new session id, which
    // we use to continue the same thread with --id.
    const sessionIdMatch = startOutput.match(/empirical session --id (\d+) -x/);
    expect(
      sessionIdMatch,
      `session id should be present in the start output:\n${startOutput}`,
    ).toBeTruthy();
    const sessionId = sessionIdMatch![1];

    // Continue the same session using --id from the previous stdout.
    const continueOutput = await runCommand(
      binaryPath,
      ["session", "--id", sessionId, "-x", secondPrompt],
      env,
      300_000,
    );
    await testInfo.attach("session-continue-output", {
      body: continueOutput,
      contentType: "text/plain",
    });
    expect(continueOutput).toMatch(/\b4\b/);
    // The continuation hint should still reference the same session id.
    expect(continueOutput).toMatch(
      new RegExp(`empirical session --id ${sessionId} -x`),
    );

    // Open the same session in the dashboard and verify the two prompts are each
    // shown exactly once (i.e. messages are not duplicated across CLI turns).
    await page.goto(`/sessions/${sessionId}`);
    await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}`));
    trackCurrentSession(page);
    await waitForFirstMessage(page);

    const firstPromptMessages = page
      .locator("[data-message-id]")
      .filter({ hasText: "say 'pong'" });
    const secondPromptMessages = page
      .locator("[data-message-id]")
      .filter({ hasText: "what is 2+2" });
    await expect(firstPromptMessages).toHaveCount(1);
    await expect(secondPromptMessages).toHaveCount(1);

    // The session title in the header is derived from the first user prompt.
    const sessionHeader = page
      .locator("header")
      .filter({ has: page.getByRole("button", { name: "Session actions" }) });
    await expect(sessionHeader.getByText(firstPrompt)).toBeVisible();

    // The user's messages are attributed to the CLI user: each user message shows
    // an avatar whose tooltip reveals the authenticated account's email. Scope to
    // the user message container and its tooltip-trigger avatar (stable data-slot),
    // and re-hover on each attempt because a live session re-renders (auto-scroll +
    // status polling) can dismiss the Radix tooltip.
    const userMessageAvatar = page
      .locator("[data-message-id]")
      .filter({ hasText: "what is 2+2" })
      .locator('[data-slot="tooltip-trigger"]');
    const userTooltip = page
      .getByRole("tooltip")
      .filter({ hasText: process.env.AUTOMATED_USER_EMAIL! });
    await expect(async () => {
      await page.mouse.move(0, 0);
      await userMessageAvatar.hover();
      await expect(userTooltip).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
  });

  test("user can log out of the CLI", async ({}, testInfo) => {
    expect(
      binaryPath,
      "the install-and-login test must run before the logout test",
    ).toBeTruthy();

    const env = cliEnv(home);
    const logoutOutput = await runCommand(binaryPath, ["logout"], env);
    await testInfo.attach("logout-output", {
      body: logoutOutput,
      contentType: "text/plain",
    });
    expect(logoutOutput).toMatch(CLI_LOGOUT_SUCCESS_PATTERN);
  });
});
