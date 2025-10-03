#!/usr/bin/env bun

import { $, type Subprocess } from "bun";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

// Parse command line arguments
const args = process.argv.slice(2);
let prompt: string | undefined;
let runOnly = false;
let evalOnly = false;
let model = "google/gemini-2.5-pro";

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--run-only' || args[i] === '-r') {
    runOnly = true;
  } else if (args[i] === '--eval-only' || args[i] === '-e') {
    evalOnly = true;
  } else if (args[i] === '--model' || args[i] === '-m') {
    model = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log("Usage: ./scripts/run-and-eval.ts [options] <prompt>");
    console.log("Options:");
    console.log("  --run-only, -r       Run only the 'run' step (no eval)");
    console.log("  --eval-only, -e      Run only the 'eval' step (no run)");
    console.log("  --model, -m <model>  Override the model to use (default: google/gemini-2.5-pro)");
    console.log("  --help, -h           Show this help message");
    process.exit(0);
  } else if (!prompt) {
    prompt = args[i];
  }
}

// Validate arguments
if (!prompt && !runOnly && !evalOnly) {
  console.error("Usage: ./scripts/run-and-eval.ts [options] <prompt>");
  console.error("Use --help for more information");
  process.exit(1);
}

// If both runOnly and evalOnly are specified, it's equivalent to running both
if (runOnly && evalOnly) {
  runOnly = false;
  evalOnly = false;
}

// If neither runOnly nor evalOnly is specified, run both by default
const runStep = runOnly || (!runOnly && !evalOnly);
const evalStep = evalOnly || (!runOnly && !evalOnly);

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
  await $`pochi -p ${prompt!} --model ${model}`;
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
    await $`bun ollie -u "http://localhost:3000" -d ${process.cwd()} -q ${prompt} -- --model ${model} --stream-json > ${Bun.file(ollieLogPath)}`.nothrow();

  if (ollieResult.exitCode !== 0) {
    throw new Error(`ollie process exited with code ${ollieResult.exitCode}`);
  }
};

const main = async (): Promise<void> => {
  try {
    if (runStep) {
      await run();
    }
    
    if (evalStep) {
      await evalCommand();
      await processOllieLog(ollieLogPath);
    }

  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
};

void main();
