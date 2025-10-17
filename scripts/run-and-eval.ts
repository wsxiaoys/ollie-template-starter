#!/usr/bin/env bun

import { Command } from "@commander-js/extra-typings";
import { $, type Subprocess } from "bun";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { runOllieEval } from "../autorater";

const program = new Command()
  .name("run-and-eval")
  .description("Run pochi and evaluate the result with ollie")
  .version("1.0.0")
  .argument("[prompt]", "The prompt to run")
  .option("-r, --run-only", "Run only the 'run' step (no eval)", false)
  .option("-e, --eval-only", "Run only the 'eval' step (no run)", false)
  .option(
    "-m, --model <model>",
    "Override the model to use",
    "google/gemini-2.5-pro"
  )
  .option(
    "-p, --port <port>",
    "Port for the dev server",
    "3000"
  )
  .option(
    "-l, --logs-dir <dir>",
    "Directory to store logs",
    "logs"
  )
  .parse(process.argv);

const options = program.opts();
const prompt = program.args[0];

// Validate arguments
if (!prompt) {
  console.error("Error: prompt argument is required");
  program.help();
}

// If both runOnly and evalOnly are specified, it's equivalent to running both
let runOnly = options.runOnly;
let evalOnly = options.evalOnly;

if (runOnly && evalOnly) {
  runOnly = false;
  evalOnly = false;
}

// If neither runOnly nor evalOnly is specified, run both by default
const runStep = runOnly || (!runOnly && !evalOnly);
const evalStep = evalOnly || (!runOnly && !evalOnly);

const logsDir = join(process.cwd(), options.logsDir);
const devServerLogPath = join(logsDir, "dev-server.log");
const pochiLogPath = join(logsDir, "pochi.log");
const ollieInstructionPath = join(logsDir, "ollie-instruction.md");
const ollieLogPath = join(logsDir, "ollie.log");
const completionOutputPath = join(logsDir, "output.json");
const screenshotPath = join(logsDir, "screenshot.jpg");
const appTsxPath = join(process.cwd(), "src", "App.tsx");
const appTsxCopyPath = join(logsDir, "App.tsx");
const promptFilePath = join(logsDir, "prompt.txt");

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
  await $`pochi -p ${prompt!} --model ${options.model} --no-mcp --stream-json > ${pochiLogPath}`;
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
      await Bun.write(Bun.file(completionOutputPath), attemptCompletionResult);
    }
  } catch (error) {
    console.error("Error processing ollie log:", error);
  }
};

const processOllieScreenshot = async (
  ollieLogPath: string,
): Promise<void> => {
  try {
    const logContent = await Bun.file(ollieLogPath).text();
    const lines = logContent.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.includes("take_screenshot")) {
        const parsed = JSON.parse(line);
        if (!Array.isArray(parsed.parts)) {
          return;
        }

        const screenshotPart = parsed.parts.find(
          (part: any) => part.type === "tool-take_screenshot",
        );
        const screenshotData = screenshotPart?.output?.content?.[1]?.data;

        if (screenshotData) {
          const image = Buffer.from(screenshotData.replace(/data:image\/(png|jpeg);base64,/, ""), "base64");
          await Bun.write(Bun.file(screenshotPath), image);
          break;
        }
      }
    }
  } catch (error) {
    console.error("Error processing Ollie screenshot:", error);
  }
};

const evalCommand = async (): Promise<void> => {
  $`echo Starting dev server... 2>&1`
  devServerProcess = Bun.spawn({
    cmd: ["bun", "dev", "--port", options.port],
    cwd: process.cwd(),
    stdout: Bun.file(devServerLogPath),
    stderr: Bun.file(devServerLogPath),
  });

  $`echo Starting ollie evaluation... 2>&1`

  await runOllieEval({
    url: `http://localhost:${options.port}`,
    dir: process.cwd(),
    question: prompt,
    logInstructions: ollieInstructionPath,
    outputFile: ollieLogPath,
  }, ["--model", options.model, "--stream-json"]);
};

const main = async (): Promise<void> => {
  try {
    // Save prompt to logs directory
    await Bun.write(Bun.file(promptFilePath), prompt!);

    if (runStep) {
      await run();
    }

    if (evalStep) {
      await evalCommand();
      await processOllieLog(ollieLogPath);
      await processOllieScreenshot(ollieLogPath)
    }

    // Copy App.tsx to logs directory
    if (existsSync(appTsxPath)) {
      copyFileSync(appTsxPath, appTsxCopyPath);
      console.log(`Copied App.tsx to ${appTsxCopyPath}`);
    }

  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
};

await main();
