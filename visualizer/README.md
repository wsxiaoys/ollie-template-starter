# Batch Visualizer

A beautiful web interface for visualizing batch evaluation results.

## Features

- 📊 Interactive table view of all batch results
- 🎨 Color-coded scores (red for failures, amber/blue/green for varying success levels)
- 📋 Detailed breakdown view for each task
- 🔍 Click on any task row to see detailed scoring information
- 📱 Responsive design

## Usage

### Start the server

```bash
cd visualizer
bun run server.ts
```

### View results

Open your browser and navigate to:

```
http://localhost:3000/batch-20250818
```

Replace `batch-20250818` with your batch directory name (relative to the project root).

## How it works

1. The server reads the batch directory structure
2. Parses all `output.json` files containing scoring information
3. Generates an interactive HTML page with:
   - Summary table showing all tasks and runs
   - Average scores across runs
   - Detailed breakdown sections for each task

## Score interpretation

- **Basic scores**: Functionality and rendering checks
- **Aesthetic scores**: Design quality evaluation
- **Total score**: Sum of basic + aesthetic scores

Color coding:
- 🔴 Red: < 0% (failures)
- 🟠 Amber: 0-49%
- 🔵 Blue: 50-79%
- 🟢 Green: 80-100%

