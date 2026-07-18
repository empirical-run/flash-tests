import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "fs";
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
  // `session listen` uses exit codes as part of its contract (0 = until-condition
  // met, 1 = stream closed, 2 = timeout), so callers can assert a non-zero code.
  expectedExitCode = 0,
) {
  const runningCommand = new RunningCommand(command, args, env);
  const exitCode = await runningCommand.waitForExit(timeoutMs);
  const output = runningCommand.getOutput();
  expect(
    output,
    `${command} ${args.join(" ")} should exit successfully`,
  ).toBeTruthy();
  expect(exitCode, output).toBe(expectedExitCode);
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
  // Set by the session test; reused by the status/listen tests that follow.
  let sessionId: string;

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
        [
          "-c",
          "curl -fsSL https://cli.empirical.run/install | EMPIRICAL_CLI_VERSION=beta sh",
        ],
        env,
        180_000,
      );
      await testInfo.attach("install-output", {
        body: installOutput,
        contentType: "text/plain",
      });
      // We opt into the beta channel via EMPIRICAL_CLI_VERSION=beta, so the
      // installer must download from the /beta/ path and report a -beta version.
      expect(installOutput).toMatch(
        /Downloading from https:\/\/cli\.empirical\.run\/beta\/empirical-(darwin|linux)-(arm64|x64)\.(?:gz|tgz)\.\.\./,
      );
      expect(installOutput).toMatch(/Installed empirical \d+\.\d+\.\d+-beta\b/);
      expect(installOutput).toContain("PATH setup");
      const shellStartupFilePattern = "\\.(?:bash_profile|bashrc|profile|zprofile|zshrc)";
      expect(installOutput).toMatch(
        new RegExp(
          `Added ${escapeRegExp(join(home, ".empirical", "bin"))} to PATH \\(${escapeRegExp(home)}/${shellStartupFilePattern}\\)`,
        ),
      );
      // The installer now auto-installs the Empirical skill globally so coding
      // agents can use the CLI (previously this was a manual "next step").
      expect(installOutput).toContain(
        "Installing the Empirical skill globally so your coding agents can use the CLI",
      );
      expect(installOutput).toContain("Skills installed");
      expect(installOutput).toMatch(
        /Agents \(global\):\s+\S*\.agents\/skills\/empirical-cli\/SKILL\.md/,
      );
      expect(installOutput).toMatch(
        /Claude Code \(global\):\s+\S*\.claude\/skills\/empirical-cli\/SKILL\.md \(symlink\)/,
      );
      // The installed skill must teach the new session commands, guarding the
      // generate-skill pipeline that keeps SKILL.md in sync with the CLI.
      const skillContent = readFileSync(
        join(home, ".agents/skills/empirical-cli/SKILL.md"),
        "utf8",
      );
      expect(skillContent).toContain("session status");
      expect(skillContent).toContain("session listen");
      expect(installOutput).toContain("Next steps");
      // The installer now configures PATH immediately, so the next steps focus on
      // sourcing the updated shell file rather than a separate login instruction.
      expect(installOutput).toMatch(
        new RegExp(
          `source "\\$HOME/${shellStartupFilePattern}"\\s+Run this \\(or open a new terminal\\) to use empirical now`,
        ),
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
      // Confirm the installed binary is a beta build (see EMPIRICAL_CLI_VERSION=beta).
      expect(versionOutput).toMatch(/\d+\.\d+\.\d+-beta\b/);

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
    sessionId = sessionIdMatch![1];

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

    // Each message renders `data-message-id` on both an outer scroller wrapper
    // and an inner div, so scope to the wrapper (data-slot="message-scroller-item")
    // to count one element per message and avoid matching the nested duplicate.
    const firstPromptMessages = page
      .locator('[data-slot="message-scroller-item"][data-message-id]')
      .filter({ hasText: "say 'pong'" });
    const secondPromptMessages = page
      .locator('[data-slot="message-scroller-item"][data-message-id]')
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
      .locator('[data-slot="message-scroller-item"][data-message-id]')
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

  test("session status reports an idle agent and an empty queue for a finished session", async ({}, testInfo) => {
    test.setTimeout(120_000);

    expect(
      sessionId,
      "the session test must run before the status test",
    ).toBeTruthy();

    const env = cliEnv(home);
    const statusOutput = await runCommand(
      binaryPath,
      ["session", "status", sessionId],
      env,
    );
    await testInfo.attach("session-status-idle-output", {
      body: statusOutput,
      contentType: "text/plain",
    });
    // The previous session finished its turns, so the agent is idle with nothing
    // queued. The sandbox line reports whatever state the session's box is in.
    expect(statusOutput).toContain(`session ${sessionId} \u00B7 agent idle`);
    expect(statusOutput).toMatch(/sandbox: \w+/);
    expect(statusOutput).toContain("queue: empty");
  });

  test("session status shows queued message contents while the agent is busy", async ({}, testInfo) => {
    test.setTimeout(300_000);

    expect(
      sessionId,
      "the session test must run before the busy-status test",
    ).toBeTruthy();

    const env = cliEnv(home);

    // Keep the agent busy inside a tool call for a predictable window so we can
    // observe a queued message before it drains (the retry-storm regression this
    // feature guards against).
    await runCommand(
      binaryPath,
      ["session", "--id", sessionId, "run 'sleep 90' in bash, then say done"],
      env,
    );
    // Fire-and-forget second prompt (no -x) while the sleep holds the agent, so
    // this send returns immediately and lands well inside the 90s window.
    await runCommand(
      binaryPath,
      ["session", "--id", sessionId, "after that, say 'queued-marker-done'"],
      env,
    );

    // Queue reconcile can lag briefly, so poll status until the agent is working
    // and the second prompt shows up queued with its contents.
    await expect(async () => {
      const busyStatus = await runCommand(
        binaryPath,
        ["session", "status", sessionId],
        env,
      );
      expect(busyStatus).toContain(`session ${sessionId} \u00B7 agent working`);
      expect(busyStatus).toMatch(/queue: [1-9]\d* pending/);
      // Assert the queued CONTENTS are shown, not just the pending count.
      expect(busyStatus).toContain("queued-marker-done");
    }).toPass({ timeout: 30_000 });
  });

  test("session listen streams the lifecycle and exits 0 when the agent goes idle", async ({}, testInfo) => {
    test.setTimeout(360_000);

    expect(
      sessionId,
      "the busy-status test must run before the listen test",
    ).toBeTruthy();

    const env = cliEnv(home);

    // Continues from the previous test's state (agent busy, one queued message).
    const listen = new RunningCommand(
      binaryPath,
      ["session", "listen", sessionId, "--until", "idle", "--timeout", "240"],
      env,
    );
    try {
      // Connect snapshot echoes the session header and the still-queued prompt.
      await listen.waitForOutput(
        new RegExp(`session ${sessionId} \u00B7`),
        60_000,
      );
      await listen.waitForOutput(/queued-marker-done/, 60_000);
      // The queue drains and the agent's reply streams in.
      await listen.waitForOutput(/dequeued|message acknowledged/, 240_000);
      await listen.waitForOutput(/assistant:/, 240_000);

      const exitCode = await listen.waitForExit(300_000);
      const output = listen.getOutput();
      await testInfo.attach("session-listen-output", {
        body: output,
        contentType: "text/plain",
      });
      // `--until idle` was reached (0), as opposed to timeout (2) or closed (1).
      expect(exitCode, output).toBe(0);
    } finally {
      listen.kill();
    }
  });

  test("session listen --events emits parseable NDJSON with the handshake frames", async ({}, testInfo) => {
    test.setTimeout(120_000);

    expect(
      sessionId,
      "the session test must run before the listen --events test",
    ).toBeTruthy();

    const env = cliEnv(home);

    const events = new RunningCommand(
      binaryPath,
      ["session", "listen", sessionId, "--events", "--timeout", "10"],
      env,
    );
    // No --until condition, so the stream runs until the 10s timeout (exit 2).
    const exitCode = await events.waitForExit(30_000);
    const output = events.getOutput();
    await testInfo.attach("session-listen-events-output", {
      body: output,
      contentType: "text/plain",
    });
    expect(exitCode, output).toBe(2);

    const frames = output
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line)); // throws (fails the test) on non-JSON output
    const types = new Set(frames.map((frame) => frame.type));
    expect(types).toContain("session_entries_replay");
    expect(types).toContain("sandbox_status");
    expect(types).toContain("agent_lifecycle_state");

    // The replay frame is the snapshot's data source and must carry the session's
    // user messages accumulated across the earlier CLI turns.
    const replay = frames.find(
      (frame) => frame.type === "session_entries_replay",
    );
    expect(replay).toBeTruthy();
    expect(replay.user_messages.length).toBeGreaterThan(0);
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
