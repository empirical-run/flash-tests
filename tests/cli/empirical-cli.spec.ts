import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Browser, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { loginWithPassword } from "../pages/login";

type CommandEnv = Record<string, string | undefined>;

const CLI_ENVIRONMENT = process.env.EMPIRICAL_CLI_AUTH_ENV ?? (process.env.TEST_RUN_ENVIRONMENT === "preview" ? "staging" : "prod");
const CLI_ENVIRONMENTS = ["prod", "staging", "local"];
const LOGIN_TIMEOUT_MS = 90_000;
const COMMAND_TIMEOUT_MS = 120_000;

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
    EMPIRICAL_ADD_TO_PATH: "no",
    EMPIRICAL_CONFIGURE_SKILL: "no",
    EMPIRICAL_ENV: CLI_ENVIRONMENT,
  };
}

async function signInAndAuthorizeCli(page: Page, authorizationUrl: string) {
  await page.goto(authorizationUrl);

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
  test("new user can install the CLI, log in, verify identity, and log out", async ({
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

    const home = mkdtempSync(join(tmpdir(), "empirical-cli-home-"));
    let loginCommand: RunningCommand | undefined;

    try {
      const env = cliEnv(home);
      const binaryPath = join(home, ".empirical", "bin", "empirical");

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
        /Downloading empirical-(darwin|linux)-(arm64|x64) from https:\/\/cli\.empirical\.run\//,
      );
      expect(installOutput).toMatch(/Installed empirical \d+\.\d+\.\d+/);
      expect(installOutput).toContain(
        `Skipped adding ${join(home, ".empirical", "bin")} to PATH.`,
      );
      expect(installOutput).toContain("Skipped Empirical skill configuration.");
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
      expect(versionOutput).toMatch(
        /You're on the latest version\.|newer version|upgrade/i,
      );

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
        /Logged in to Empirical CLI\./,
        LOGIN_TIMEOUT_MS,
      );
      const loginExitCode = await loginCommand.waitForExit(LOGIN_TIMEOUT_MS);
      const loginOutput = loginCommand.getOutput();
      await testInfo.attach("login-output", {
        body: loginOutput,
        contentType: "text/plain",
      });
      expect(loginExitCode, loginOutput).toBe(0);
      expect(loginOutput).toContain("Logged in to Empirical CLI.");

      const whoamiOutput = await runCommand(binaryPath, ["whoami"], env);
      await testInfo.attach("whoami-output", {
        body: whoamiOutput,
        contentType: "text/plain",
      });
      expect(whoamiOutput).toMatch(/user_id:\s+[0-9a-f-]{36}/i);
      expect(whoamiOutput).toContain(
        `email:   ${process.env.AUTOMATED_USER_EMAIL}`,
      );

      const logoutOutput = await runCommand(binaryPath, ["logout"], env);
      await testInfo.attach("logout-output", {
        body: logoutOutput,
        contentType: "text/plain",
      });
      expect(logoutOutput).toContain(
        `Logged out of Empirical CLI (${CLI_ENVIRONMENT}).`,
      );
    } finally {
      loginCommand?.kill();
      rmSync(home, { recursive: true, force: true });
    }
  });
});
