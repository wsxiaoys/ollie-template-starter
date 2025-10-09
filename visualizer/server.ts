#!/usr/bin/env bun

import homepage from "./index.html"

import { readdirSync, existsSync, readFileSync } from 'fs';
import { join, relative } from 'path';

interface ScoreItem {
  title: string;
  reasoning: string;
  score: number;
}

interface OutputData {
  basic: ScoreItem[];
  aesthetic: ScoreItem[];
}

interface RunResult {
  run: string;
  basicScore: number;
  basicTotal: number;
  aestheticScore: number;
  aestheticTotal: number;
  totalScore: number;
  totalPossible: number;
  exists: boolean;
  data?: OutputData;
  screenshot?: string;
}

interface TaskResults {
  taskId: string;
  runs: RunResult[];
}

function calculateScore(data: OutputData): {
  basicScore: number;
  basicTotal: number;
  aestheticScore: number;
  aestheticTotal: number;
  totalScore: number;
  totalPossible: number;
} {
  const basicScore = data.basic.reduce((sum, item) => sum + item.score, 0);
  const basicTotal = data.basic.length;
  const aestheticScore = data.aesthetic.reduce((sum, item) => sum + item.score, 0);
  const aestheticTotal = data.aesthetic.length;

  return {
    basicScore,
    basicTotal,
    aestheticScore,
    aestheticTotal,
    totalScore: basicScore + aestheticScore,
    totalPossible: basicTotal + aestheticTotal,
  };
}

function loadBatchResults(batchDir: string): TaskResults[] {
  const batchPath = join(process.cwd(), 'batches', batchDir);

  if (!existsSync(batchPath)) {
    throw new Error(`Batch directory not found: ${batchPath}`);
  }

  const entries = readdirSync(batchPath, { withFileTypes: true });
  const taskDirs = entries.filter(entry => entry.isDirectory());

  const results: TaskResults[] = [];

  for (const taskDir of taskDirs) {
    const taskPath = join(batchPath, taskDir.name);
    const runDirs = readdirSync(taskPath, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
      .sort((a, b) => parseInt(a.name) - parseInt(b.name));

    const runs: RunResult[] = [];

    for (const runDir of runDirs) {
      const runPath = join(taskPath, runDir.name);
      const outputPath = join(runPath, 'output.json');
      const screenshot = existsSync(join(runPath, 'screenshot.jpg')) 
        ? `/data/${batchDir}/${taskDir.name}/${runDir.name}/screenshot.jpg`
        : undefined;

      if (existsSync(outputPath)) {
        try {
          const data = JSON.parse(readFileSync(outputPath, 'utf-8')) as OutputData;
          const scores = calculateScore(data);

          runs.push({
            run: runDir.name,
            ...scores,
            exists: true,
            data,
            screenshot,
          });
        } catch (error) {
          runs.push({
            run: runDir.name,
            basicScore: 0,
            basicTotal: 0,
            aestheticScore: 0,
            aestheticTotal: 0,
            totalScore: 0,
            totalPossible: 0,
            exists: false,
            screenshot,
          });
        }
      } else {
        runs.push({
          run: runDir.name,
          basicScore: 0,
          basicTotal: 0,
          aestheticScore: 0,
          aestheticTotal: 0,
          totalScore: 0,
          totalPossible: 0,
          exists: false,
          screenshot,
        });
      }
    }

    if (runs.length > 0) {
      results.push({
        taskId: taskDir.name,
        runs,
      });
    }
  }

  return results.sort((a, b) => a.taskId.localeCompare(b.taskId));
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = Bun.serve({
  port: 3020,
  routes: {
    "/": homepage,
    "/index.css": {
      GET() {
        return new Response(Bun.file(join(import.meta.dir, 'index.css')), {
          headers: { 'Content-Type': 'text/css' }
        });
      }
    },
    '/api/batches': {
      GET(req) {
        const batchesPath = join(process.cwd(), 'batches');
        if (!existsSync(batchesPath)) {
          return new Response(JSON.stringify([]), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const entries = readdirSync(batchesPath, { withFileTypes: true });
        const batchDirs = entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort().reverse();
        return new Response(JSON.stringify(batchDirs), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    },
    '/api/batches/:batchDir': {
      GET(req) {
        const { batchDir } = req.params as { batchDir: string };
        try {
          const results = loadBatchResults(batchDir);
          return new Response(JSON.stringify(results), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'An unknown error occurred';
          return new Response(JSON.stringify({ error: message }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    },
    '/data/:batchDir/:taskId/:run/:filename': {
      GET(req) {
        const { batchDir, taskId, run, filename } = req.params as { batchDir: string, taskId: string, run: string, filename: string };
        const filePath = join(process.cwd(), 'batches', batchDir, taskId, run, filename);
        if (existsSync(filePath)) {
          return new Response(Bun.file(filePath), { headers: corsHeaders });
        }
        return new Response('File not found', { status: 404, headers: corsHeaders });
      }
    }
  }
});

console.log(`\n🚀 Batch Visualizer API Server started!`);
console.log(`\n📍 Listening on: http://localhost:${server.port}`);
