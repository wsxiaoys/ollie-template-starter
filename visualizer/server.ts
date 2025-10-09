#!/usr/bin/env bun
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

function loadScreenshot(runPath: string): string | undefined {
  const screenshotPath = join(runPath, 'screenshot.jpg');
  if (!existsSync(screenshotPath)) {
    return undefined;
  }

  try {
    const buffer = readFileSync(screenshotPath);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error(`Failed to load screenshot for ${runPath}:`, error);
    return undefined;
  }
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
      const screenshot = join("data", batchDir, relative(batchPath, join(runPath, 'screenshot.jpg')))

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

function generateHTML(batchDir: string, results: TaskResults[]): string {
  const maxRuns = Math.max(...results.map(r => r.runs.length));

  const getScoreColor = (score: number, total: number): string => {
    if (total === 0) return '#6B7280';
    const percentage = (score / total) * 100;
    if (percentage < 0) return '#DC2626'; // red for negative
    if (percentage < 50) return '#F59E0B'; // amber
    if (percentage < 80) return '#3B82F6'; // blue
    return '#10B981'; // green
  };

  const formatPercentage = (score: number, total: number): string => {
    if (total === 0) return 'N/A';
    const percentage = (score / total) * 100;
    return `${percentage.toFixed(0)}%`;
  };

  const renderScreenshot = (src: string | undefined, alt: string): string => {
    const placeholderStyles = 'width: 160px; height: 120px;';

    if (!src) {
      return `
        <div style="${placeholderStyles} display: flex; align-items: center; justify-content: center; background: #F3F4F6; color: #9CA3AF; border-radius: 8px; border: 1px dashed #D1D5DB; font-size: 0.75rem; font-weight: 600;">
          No Screenshot
        </div>
      `;
    }
    return `<a href="${src}" target="_blank" rel="noopener noreferrer"><img src="${src}" alt="${alt}" class="screenshot-thumb" /></a>`;
  };

  let tableRows = '';
  for (const task of results) {
    let totalScore = 0;
    let totalPossible = 0;
    let validRunCount = 0;

    const sortedRuns = [...task.runs].sort((a, b) => {
      if (a.exists !== b.exists) {
        return a.exists ? -1 : 1;
      }
      if (!a.exists) {
        return parseInt(a.run) - parseInt(b.run);
      }
      const scoreA = a.totalPossible > 0 ? a.totalScore / a.totalPossible : 0;
      const scoreB = b.totalPossible > 0 ? b.totalScore / b.totalPossible : 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return parseInt(a.run) - parseInt(b.run);
    });

    let runCells = '';
    for (let i = 0; i < maxRuns; i++) {
      if (i < sortedRuns.length) {
        const run = sortedRuns[i];
        if (run.exists) {
          const totalColor = getScoreColor(run.totalScore, run.totalPossible);
          const totalPct = formatPercentage(run.totalScore, run.totalPossible);

          const basicColor = getScoreColor(run.basicScore, run.basicTotal);

          const aestheticColor = getScoreColor(run.aestheticScore, run.aestheticTotal);

          runCells += `
            <td style="padding: 16px; text-align: center; border-bottom: 1px solid #E5E7EB; vertical-align: middle;">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                ${renderScreenshot(run.screenshot, `Run ${run.run} Screenshot`)}
                <a href="/data/${batchDir}/${task.taskId}/${run.run}/output.json" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit;"><div style="font-weight: 600; color: ${totalColor}; font-size: 1.1rem;">${run.totalScore}/${run.totalPossible} (${totalPct})</div></a>
                <div style="width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.8rem; text-align: left;">
                  <div style="color: ${basicColor};"><strong>B:</strong> ${run.basicScore}/${run.basicTotal}</div>
                  <div style="color: ${aestheticColor};"><strong>A:</strong> ${run.aestheticScore}/${run.aestheticTotal}</div>
                </div>
              </div>
            </td>
          `;
          totalScore += run.totalScore;
          totalPossible += run.totalPossible;
          validRunCount++;
        } else {
          runCells += `
            <td style="padding: 16px; text-align: center; border-bottom: 1px solid #E5E7EB; vertical-align: middle;">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                ${renderScreenshot(run.screenshot, `Run ${run.run} Screenshot`)}
                <span style="color: #DC2626; font-weight: 600;">ERROR</span>
              </div>
            </td>
          `;
        }
      } else {
        runCells += `<td style="padding: 16px; border-bottom: 1px solid #E5E7EB;"></td>`;
      }
    }

    let avgCell = '';
    if (validRunCount > 0) {
      const avgScore = totalScore / validRunCount;
      const avgPossible = totalPossible / validRunCount;
      const avgColor = getScoreColor(totalScore, totalPossible);
      const avgPct = formatPercentage(totalScore, totalPossible);
      avgCell = `
        <td style="padding: 16px; text-align: center; border-bottom: 1px solid #E5E7EB; background-color: #F9FAFB; vertical-align: middle;">
          <div style="font-weight: 700; color: ${avgColor}; font-size: 1.1rem;">${avgScore.toFixed(1)}/${avgPossible.toFixed(1)}</div>
          <div style="font-size: 0.875rem; color: #6B7280;">${avgPct}</div>
        </td>
      `;
    } else {
      avgCell = `<td style="padding: 16px; text-align: center; border-bottom: 1px solid #E5E7EB; background-color: #F9FAFB;">-</td>`;
    }

    tableRows += `
      <tr onmouseover="this.style.backgroundColor='#F3F4F6'" onmouseout="this.style.backgroundColor='white'">
        <td style="padding: 16px; font-weight: 600; color: #1F2937; border-bottom: 1px solid #E5E7EB;">${task.taskId}</td>
        ${runCells}
        ${avgCell}
      </tr>
    `;
  }

  let headerCells = '';
  for (let i = 1; i <= maxRuns; i++) {
    headerCells += `<th style="padding: 12px; text-align: center; border-bottom: 2px solid #E5E7EB; width: 200px;">Rank ${String(i).padStart(2, '0')}</th>`;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Results: ${batchDir}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #F3F4F6;
      min-height: 100vh;
      padding: 32px;
    }
    .container {
      max-width: 95%;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.25rem;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 1.125rem;
      opacity: 0.9;
    }
    .content {
      padding: 32px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background-color: #F9FAFB;
      color: #374151;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }
    .screenshot-thumb {
      width: 160px;
      height: 120px;
      object-fit: scale-down;
      border-radius: 8px;
      border: 1px solid #E5E7EB;
      transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Batch Results</h1>
      <p>${batchDir}</p>
    </div>
    
    <div class="content">
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #E5E7EB;">Task ID</th>
              ${headerCells}
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #E5E7EB;">Average</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

const server = Bun.serve({
  port: 3020,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/') {
      // Default page
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Visualizer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .container {
      max-width: 600px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      padding: 48px;
      text-align: center;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      color: #1F2937;
      margin-bottom: 16px;
    }
    p {
      font-size: 1.125rem;
      color: #6B7280;
      margin-bottom: 32px;
    }
    .example {
      background-color: #F3F4F6;
      padding: 16px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      color: #374151;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Batch Visualizer</h1>
    <p>View batch evaluation results in a beautiful, interactive format.</p>
    <div class="example">
      <div style="margin-bottom: 8px; font-weight: 600;">Usage:</div>
      <div>http://localhost:3000/batch-20250818</div>
    </div>
  </div>
</body>
</html>
      `;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const dataMatch = url.pathname.match(/^\/data\/(.+?)\/(.+?)\/(\d+)\/(.+)$/);
    if (dataMatch) {
      const [, batchDir, taskId, run, filename] = dataMatch;
      const filePath = join(process.cwd(), 'batches', batchDir, taskId, run, filename);
      if (existsSync(filePath)) {
        try {
          if (filename.endsWith(".json")) {
            const fileContent = readFileSync(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);
            const formattedJson = JSON.stringify(jsonData, null, 2);
            return new Response(formattedJson, {
              headers: { 'Content-Type': 'application/json' },
            });
          } else {
            return new Response(Bun.file(filePath));
          }
        } catch (error) {
          return new Response('Error reading or parsing output.json', { status: 500 });
        }
      }
      return new Response('output.json not found', { status: 404 });
    }

    // Handle batch visualization
    const batchDir = url.pathname.slice(1);

    if (batchDir) {
      try {
        const results = loadBatchResults(batchDir);
        const html = generateHTML(batchDir, results);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        });
      } catch (error) {
        const errorHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #1F2937;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .error {
      max-width: 600px;
      text-align: center;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 16px;
    }
    p {
      font-size: 1.25rem;
      margin-bottom: 8px;
    }
    .message {
      background-color: #374151;
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="error">
    <h1>⚠️ Error</h1>
    <p>Failed to load batch results</p>
    <div class="message">${error instanceof Error ? error.message : String(error)}</div>
  </div>
</body>
</html>
        `;
        return new Response(errorHTML, {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`\n🚀 Batch Visualizer Server started!`);
console.log(`\n📍 Open in your browser:`);
console.log(`   http://localhost:${server.port}`);
console.log(`\n💡 Example:`);
console.log(`   http://localhost:${server.port}/batch-20250818\n`);
