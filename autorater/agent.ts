#!/usr/bin/env bun

import { $ } from "bun";
import process from "node:process";
import { buildPrompt } from "./prompt.ts";

export interface EvalOptions {
  url: string;
  dir?: string;
  question: string;
  logInstructions?: string;
  outputFile?: string;
}

export async function runOllieEval(options: EvalOptions, pochiArgs: string[]) {
  const instructions = buildPrompt(options.url, options.dir, options.question);

  // Log instructions if flag is set
  if (options.logInstructions) {
    // Write to file
    await Bun.write(Bun.file(options.logInstructions), instructions);
  }

  const schema = `(() => {const checklist=z.array(z.object({title: z.string(),reasoning:z.string(),score:z.number()}));return z.object({basic: checklist, aesthetic: checklist});})()`;
  
  await $`echo "Please start evaluation" | pochi ${pochiArgs} --experimental-output-schema ${schema} > ${options.outputFile || '/dev/null'}`.env({
    ...process.env,
    POCHI_CUSTOM_INSTRUCTIONS: instructions,
  });
}
