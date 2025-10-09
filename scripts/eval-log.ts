#!/usr/bin/env bun

import { Command } from "@commander-js/extra-typings";
import { $, type Subprocess } from "bun";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";
import { runOllieEval } from "../autorater";

const program = new Command()
  .name("eval-log")
  .description("Run evaluation using App.tsx from an existing log directory")
  .version("1.0.0")
  .argument("<input-log-dir>", "The log directory containing App.tsx to evaluate")
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
    "-o, --logs-dir <dir>",
    "Directory to store new evaluation logs (defaults to input-log-dir/reeval/<timestamp>)"
  )
  .parse(process.argv);

const options = program.opts();
const inputLogDir = join(process.cwd(), program.args[0]);

// Validate input log directory exists
if (!existsSync(inputLogDir)) {
  console.error(`Error: Input log directory does not exist: ${inputLogDir}`);
  process.exit(1);
}

// Check if App.tsx exists in the input log directory
const inputAppTsxPath = join(inputLogDir, "App.tsx");
if (!existsSync(inputAppTsxPath)) {
  console.error(`Error: App.tsx not found in log directory: ${inputLogDir}`);
  process.exit(1);
}

// Try to read prompt from prompt.txt if not provided
const promptFile = join(inputLogDir, "prompt.txt");
if (!existsSync(promptFile)) {
  console.error("Error: prompt argument is required (or provide prompt.txt in log directory)");
  program.help();
}
const prompt = await Bun.file(promptFile).text();

// Determine output directory
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] + "_" + new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
const outputLogDir = options.logsDir
  ? join(process.cwd(), options.logsDir)
  : join(inputLogDir, `reeval/${timestamp}`);

// Create output directory
if (!existsSync(outputLogDir)) {
  mkdirSync(outputLogDir, { recursive: true });
}

const devServerLogPath = join(outputLogDir, "dev-server.log");
const ollieInstructionPath = join(outputLogDir, "ollie-instruction.md");
const ollieLogPath = join(outputLogDir, "ollie.log");
const completionOutputPath = join(outputLogDir, "output.json");
const screenshotPath = join(outputLogDir, "screenshot.jpg");
const appTsxPath = join(process.cwd(), "src", "App.tsx");
const appTsxCopyPath = join(outputLogDir, "App.tsx");
const promptFilePath = join(outputLogDir, "prompt.txt");

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
          const image = Buffer.from(screenshotData, "base64");
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
  console.log("Starting dev server...");
  devServerProcess = Bun.spawn({
    cmd: ["bun", "dev", "--port", options.port],
    cwd: process.cwd(),
    stdout: Bun.file(devServerLogPath),
    stderr: Bun.file(devServerLogPath),
  });

  console.log("Starting ollie evaluation...");

  await runOllieEval({
    url: `http://localhost:${options.port}`,
    dir: process.cwd(),
    question: prompt!,
    logInstructions: ollieInstructionPath,
    outputFile: ollieLogPath,
  }, ["--model", options.model, "--stream-json"]);
};

const main = async (): Promise<void> => {
  try {
    // Copy App.tsx from input log dir to src/App.tsx
    console.log(`Copying App.tsx from ${inputLogDir} to ${appTsxPath}`);
    copyFileSync(inputAppTsxPath, appTsxPath);

    // Save prompt to output directory
    await Bun.write(Bun.file(promptFilePath), prompt!);

    // Copy App.tsx to output directory as well
    copyFileSync(appTsxPath, appTsxCopyPath);

    // Run evaluation
    await evalCommand();
    await processOllieLog(ollieLogPath);
    await processOllieScreenshot(ollieLogPath);

    console.log(`\nEvaluation complete!`);
    console.log(`Results saved to: ${outputLogDir}`);

  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
};

await main();

