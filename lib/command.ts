import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { expect } from "@playwright/test";

export type CommandEnv = Record<string, string | undefined>;

export const COMMAND_TIMEOUT_MS = 120_000;

export class RunningCommand {
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

export async function runCommand(
  command: string,
  args: string[],
  env: CommandEnv,
  timeoutMs = COMMAND_TIMEOUT_MS,
  // `session logs -f` uses exit codes as part of its contract (0 = until-condition
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
