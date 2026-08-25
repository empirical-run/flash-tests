import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Browser, Page } from "@playwright/test";
import { test, expect } from "../fixtures";
import { loginWithPassword } from "../pages/login";
import { getDashboardBaseUrl } from "../pages/urls";
import { waitForFirstMessage } from "../pages/sessions";
import { getProjectSlug } from "../pages/settings";

type CommandEnv = Record<string, string | undefined>;

const CLI_ENVIRONMENT =
  process.env.EMPIRICAL_CLI_AUTH_ENV ??
  (process.env.TEST_RUN_ENVIRONMENT === "preview" ? "staging" : "prod");
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

function cliEnv(home: string, localBinOnPath = true): CommandEnv {
  if (!CLI_ENVIRONMENTS.includes(CLI_ENVIRONMENT)) {
    throw new Error("EMPIRICAL_CLI_AUTH_ENV must be prod, staging, or local");
  }

  const path = localBinOnPath
    ? `${join(home, ".local", "bin")}:${process.env.PATH ?? ""}`
    : process.env.PATH;

  return {
    ...process.env,
    HOME: home,
    PATH: path,
    CI: "true",
    EMPIRICAL_CONFIGURE_SKILL: "no",
    EMPIRICAL_ENV: CLI_ENVIRONMENT,
    EMPIRICAL_DASHBOARD_URL: getDashboardBaseUrl(),
    // Exercise real CLI OAuth rather than the agent sandbox's authenticated API
    // proxy, which deliberately bypasses `empirical login` when inherited.
    EMPIRICAL_API_URL: undefined,
  };
}

async function resolveAuthorizationUrlForBrowser(
  page: Page,
  authorizationUrl: string,
) {
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
  await page.goto(
    await resolveAuthorizationUrlForBrowser(page, authorizationUrl),
  );

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
    process.env.TEST_RUN_ENVIRONMENT === "preview" ||
      process.env.ENV_SLUG === "preview",
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
      // Keep ~/.local/bin on the live PATH used by the installer and every CLI
      // command below. The installer should make the CLI immediately available
      // there instead of editing a shell startup file.
      const env = cliEnv(home);
      binaryPath = join(home, ".empirical", "bin", "empirical");
      const localBinPath = join(home, ".local", "bin");
      const linkedBinaryPath = join(localBinPath, "empirical");

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
      expect(installOutput).toContain(
        `Linked ${linkedBinaryPath} -> ${binaryPath} (no new terminal needed)`,
      );
      expect(installOutput).not.toContain("Next steps");
      const shellStartupFiles = [
        ".bash_profile",
        ".bashrc",
        ".profile",
        ".zprofile",
        ".zshrc",
      ];
      expect(installOutput).not.toMatch(
        new RegExp(
          `Added ${escapeRegExp(join(home, ".empirical", "bin"))} to PATH`,
        ),
      );
      for (const startupFile of shellStartupFiles) {
        expect(
          existsSync(join(home, startupFile)),
          `installer should not modify ${startupFile} when ~/.local/bin is already on PATH`,
        ).toBe(false);
      }
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
      expect(
        existsSync(binaryPath),
        "installer writes the standalone binary to ~/.empirical/bin/empirical",
      ).toBe(true);
      expect(statSync(binaryPath).isFile()).toBe(true);
      expect(lstatSync(linkedBinaryPath).isSymbolicLink()).toBe(true);
      expect(readlinkSync(linkedBinaryPath)).toBe(binaryPath);

      // Resolve by command name through the live PATH: no profile sourcing or new
      // shell is needed after the installer creates ~/.local/bin/empirical.
      const versionOutput = await runCommand("empirical", ["version"], env);
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

    // Continue the same session using --id from the previous stdout. The first
    // `-x` left the agent idle, so there is no active turn to steer or a need to
    // request `--follow-up`; this `-x` waits for the new turn to finish.
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
    // Note: we intentionally do NOT track the session for cleanup here. The
    // status/listen tests below reuse this same session (and its live sandbox),
    // so it is only closed after the last test that needs it (see the
    // `session listen --events` test).
    await page.goto(`/sessions/${sessionId}`);
    await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}`));
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

    // The second prompt is rendered as a user message, with the user's avatar.
    // User-message avatars no longer expose an identity tooltip in the dashboard.
    await expect(
      secondPromptMessages.locator('[data-slot="message"][data-align="end"]'),
    ).toBeVisible();
    await expect(secondPromptMessages.locator("svg.lucide-user")).toBeVisible();
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

  test("a message sent during an active turn steers that turn by default", async ({}, testInfo) => {
    test.setTimeout(300_000);

    expect(
      sessionId,
      "the session test must run before the steer-default test",
    ).toBeTruthy();

    const env = cliEnv(home);
    let listen: RunningCommand | undefined;

    try {
      // Listen without an idle exit condition before starting the turn, so no
      // tool-call event can occur in the gap between sending and connecting.
      listen = new RunningCommand(
        binaryPath,
        ["session", "listen", sessionId, "--timeout", "240"],
        env,
      );
      await listen.waitForOutput(new RegExp(`session ${sessionId} \\u00B7`));

      // Hold an existing turn inside a tool call. Its original response marker
      // lets us distinguish steering this turn from queueing a separate turn.
      await runCommand(
        binaryPath,
        [
          "session",
          "--id",
          sessionId,
          "run 'sleep 45' in bash, then respond exactly 'original-turn-marker'",
        ],
        env,
      );
      await listen.waitForOutput(
        /bash\(\{"command":"sleep 45"(?:,"timeout":\d+)?\}\)/,
        60_000,
      );

      // No --follow-up: the new default deliberately steers this message into
      // the active turn instead of leaving it queued for a later turn.
      await runCommand(
        binaryPath,
        [
          "session",
          "--id",
          sessionId,
          "change your current response: do not say the original marker; respond exactly 'steered-default-marker' after the sleep finishes",
        ],
        env,
      );

      // Wait until listen acknowledges the second message. The human-readable
      // delivery line truncates long prompts, so acknowledgment is the reliable
      // signal that the server has accepted it.
      await listen.waitForOutput(/message acknowledged/, 30_000);

      // Keep the same listener connected through the tool boundary and assert
      // the observable outcome: the active turn uses the steered response
      // instead of completing its original response and starting a follow-up turn.
      await listen.waitForOutput(
        /assistant:\s*steered-default-marker/i,
        90_000,
      );
      await listen.waitForOutput(/agent run finished/i, 30_000);
      await expect(async () => {
        const status = await runCommand(
          binaryPath,
          ["session", "status", sessionId],
          env,
        );
        expect(status).toContain(`session ${sessionId} \u00B7 agent idle`);
      }).toPass({ timeout: 30_000 });

      const output = listen.getOutput();
      await testInfo.attach("session-listen-steer-output", {
        body: output,
        contentType: "text/plain",
      });
      expect(output).not.toMatch(/assistant:\s*original-turn-marker/i);
      expect(output.match(/agent run started/gi)).toHaveLength(1);
      expect(output.match(/agent run finished/gi)).toHaveLength(1);
    } finally {
      listen?.kill();
    }
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
    // Deliberately queue the second prompt for the next turn rather than steering
    // the active turn. `--follow-up` guarantees it remains queued while the sleep
    // holds the agent, and omitting -x makes this fire-and-forget send return now.
    await runCommand(
      binaryPath,
      [
        "session",
        "--id",
        sessionId,
        "--follow-up",
        "after that, say 'queued-marker-done'",
      ],
      env,
    );

    // Queue reconcile can lag briefly, so poll status until the agent is working
    // and the second prompt shows up queued with its contents.
    let busyStatus = "";
    await expect(async () => {
      busyStatus = await runCommand(
        binaryPath,
        ["session", "status", sessionId],
        env,
      );
      expect(busyStatus).toContain(`session ${sessionId} \u00B7 agent working`);
      expect(busyStatus).toMatch(/queue: [1-9]\d* pending/);
      // Assert the queued CONTENTS are shown, not just the pending count.
      expect(busyStatus).toContain("queued-marker-done");
    }).toPass({ timeout: 30_000 });
    await testInfo.attach("session-status-busy-output", {
      body: busyStatus,
      contentType: "text/plain",
    });
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

  test("session listen --events emits parseable NDJSON with the handshake frames", async ({
    page,
    trackCurrentSession,
  }, testInfo) => {
    test.setTimeout(120_000);

    expect(
      sessionId,
      "the session test must run before the listen --events test",
    ).toBeTruthy();

    // This is the last test that reuses the shared CLI session, so register it
    // for cleanup now (afterEach closes it once this test completes).
    await page.goto(`/sessions/${sessionId}`);
    trackCurrentSession(page);

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
    const types = frames.map((frame) => frame.type);
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

test("installer falls back to shell profile setup when local bin is not on PATH", async ({}, testInfo) => {
  test.setTimeout(240_000);

  const fallbackHome = mkdtempSync(
    join(tmpdir(), "empirical-cli-fallback-home-"),
  );
  try {
    const env = cliEnv(fallbackHome, false);
    const installedBinDirectory = join(fallbackHome, ".empirical", "bin");
    const installOutput = await runCommand(
      "sh",
      [
        "-c",
        "curl -fsSL https://cli.empirical.run/install | EMPIRICAL_CLI_VERSION=beta sh",
      ],
      env,
      180_000,
    );
    await testInfo.attach("fallback-install-output", {
      body: installOutput,
      contentType: "text/plain",
    });

    const shellStartupFilePattern =
      "\\.(?:bash_profile|bashrc|profile|zprofile|zshrc)";
    const profileMatch = installOutput.match(
      new RegExp(
        `Added ${escapeRegExp(installedBinDirectory)} to PATH \\(([^)]+/${shellStartupFilePattern})\\)`,
      ),
    );
    expect(
      profileMatch,
      `installer should report the shell profile it updated:\n${installOutput}`,
    ).toBeTruthy();
    expect(installOutput).toContain("Next steps");
    expect(installOutput).toMatch(
      new RegExp(
        `source "\\$HOME/${shellStartupFilePattern}"\\s+Run this \\(or open a new terminal\\) to use empirical now`,
      ),
    );

    const startupFile = profileMatch![1];
    expect(existsSync(startupFile)).toBe(true);
    expect(readFileSync(startupFile, "utf8")).toContain(installedBinDirectory);
    expect(installOutput).not.toContain("no new terminal needed");
    expect(existsSync(join(fallbackHome, ".local", "bin", "empirical"))).toBe(
      false,
    );
  } finally {
    rmSync(fallbackHome, { recursive: true, force: true });
  }
});
