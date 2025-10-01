#!/usr/bin/env bun

import { $, type Subprocess } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const prompt = process.argv[2];

if (!prompt) {
  console.error("Usage: ./scripts/run-and-eval.ts <prompt>");
  process.exit(1);
}

const logsDir = join(process.cwd(), "logs");
const devServerLogPath = join(logsDir, "dev-server.log");
const ollieLogPath = join(logsDir, "ollie.log");
const screenshotPath = join(logsDir, "screenshot.jpg");

if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

let devServerProcess: Subprocess | null = null;

const cleanup = async (): Promise<void> => {
  if (!devServerProcess) {
    return;
  }

  try {
    if (!devServerProcess.killed) {
      devServerProcess.kill();
    }
    await devServerProcess.exited;
  } catch (error) {
    console.error("Error stopping dev server:", error);
  } finally {
    devServerProcess = null;
  }
};

const handleSignal = (signal: NodeJS.Signals) => {
  void (async () => {
    await cleanup();
    process.exit(signal === "SIGINT" ? 130 : 0);
  })();
};

process.on("SIGINT", () => handleSignal("SIGINT"));
process.on("SIGTERM", () => handleSignal("SIGTERM"));

const run = async (): Promise<void> => {
  await $`pochi -p ${prompt} --model google/gemini-2.5-pro`;
};

const processOllieLog = async (ollieLogPath: string): Promise<void> => {
  try {
    const logContent = await Bun.file(ollieLogPath).text();
    const lastLine = logContent.trim().split("\n").at(-1);

    if (!lastLine) {
      return;
    }

    const parsed = JSON.parse(lastLine);
    if (!Array.isArray(parsed.parts)) {
      return;
    }

    const attemptCompletionPart = parsed.parts.find(
      (part: any) => part.type === "tool-attemptCompletion",
    );
    const attemptCompletionResult = attemptCompletionPart?.input?.result;

    if (attemptCompletionResult) {
      console.log(
        JSON.stringify(JSON.parse(attemptCompletionResult), null, 2),
      );
    }

    const screenshotPart = parsed.parts.find(
      (part: any) => part.type === "tool-take_screenshot",
    );
    const screenshotData = screenshotPart?.output?.content?.[1]?.data;

    if (screenshotData) {
      const image = Buffer.from(screenshotData, "base64");
      await Bun.write(Bun.file(screenshotPath), image);
    }
  } catch (error) {
    console.error("Error processing ollie log:", error);
  }
};


const evalCommand = async (): Promise<void> => {
  $`echo Starting dev server... 2>&1`
  devServerProcess = Bun.spawn({
    cmd: ["bun", "dev"],
    cwd: process.cwd(),
    stdout: Bun.file(devServerLogPath),
    stderr: Bun.file(devServerLogPath),
  });

  $`echo Starting ollie evaluation... 2>&1`

  const ollieResult =
    await $`bun ollie -u "http://localhost:3000" -d ${process.cwd()} -q ${prompt} -- --model google/gemini-2.5-pro --stream-json > ${Bun.file(ollieLogPath)}`.nothrow();

  if (ollieResult.exitCode !== 0) {
    throw new Error(`ollie process exited with code ${ollieResult.exitCode}`);
  }
};

const main = async (): Promise<void> => {
  try {
    await run();
    await evalCommand();
    await processOllieLog(ollieLogPath);

  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
};

void main();
