import React, { useState, useEffect } from 'react';

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

interface TaskResult {
  taskId: string;
  runs: RunResult[];
}

const getScoreColor = (score: number, total: number): string => {
  if (total === 0) return 'score-gray';
  const percentage = (score / total) * 100;
  if (percentage < 0) return 'score-red';
  if (percentage < 50) return 'score-amber';
  if (percentage < 80) return 'score-blue';
  return 'score-green';
};

const formatPercentage = (score: number, total: number): string => {
  if (total === 0) return 'N/A';
  return `${((score / total) * 100).toFixed(0)}%`;
};

const App = () => {
  const [batches, setBatches] = useState<string[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [results, setResults] = useState<TaskResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [maxRuns, setMaxRuns] = useState<number>(0);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const response = await fetch("/api/batches");
        if (!response.ok) throw new Error('Failed to fetch batches');
        const data = await response.json();
        setBatches(data);
        if (data.length > 0) {
          setSelectedBatch(data[0]);
        }
      } catch (err) {
        setError('Failed to load batches. Is the visualizer server running?');
      }
    };
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      const fetchResults = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/batches/${selectedBatch}`);
          if (!response.ok) throw new Error(`Batch '${selectedBatch}' not found.`);
          const data = await response.json();
          setResults(data);
          const max = Math.max(...data.map((r: TaskResult) => r.runs.length));
          setMaxRuns(max);
        } catch (err) {
          setError((err as Error).message);
          setResults([]);
        } finally {
          setLoading(false);
        }
      };
      fetchResults();
    }
  }, [selectedBatch]);

  return (
    <div>
      <div className="container">
        {/* Header */}
        <div className="header">
          <h1>📊 Batch Results Visualizer</h1>
          <p>{selectedBatch || 'Select a batch'}</p>
        </div>

        {/* Batch Selector */}
        <div className="batch-selector">
          <div className="batch-selector-content">
            <label htmlFor="batch-select">Select Batch:</label>
            <select
              id="batch-select"
              onChange={e => setSelectedBatch(e.target.value)}
              value={selectedBatch}
            >
              {batches.map(batch => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="alert">
            <span className="alert-icon">⚠️</span>
            <p className="alert-message">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p className="loading-text">Loading results...</p>
          </div>
        )}

        {/* Results Table */}
        {!loading && results.length > 0 && (
          <div className="results-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  {[...Array(maxRuns)].map((_, i) => (
                    <th key={i}>Rank {String(i + 1).padStart(2, '0')}</th>
                  ))}
                  <th className="average-col">Average</th>
                </tr>
              </thead>
              <tbody>
                {results.map(task => {
                  let totalScore = 0;
                  let totalPossible = 0;
                  let validRunCount = 0;
                  
                  const sortedRuns = [...task.runs].sort((a, b) => {
                    if (a.exists !== b.exists) return a.exists ? -1 : 1;
                    if (!a.exists) return parseInt(a.run) - parseInt(b.run);
                    const scoreA = a.totalPossible > 0 ? a.totalScore / a.totalPossible : 0;
                    const scoreB = b.totalPossible > 0 ? b.totalScore / b.totalPossible : 0;
                    if (scoreA !== scoreB) return scoreB - scoreA;
                    return parseInt(a.run) - parseInt(b.run);
                  });

                  return (
                    <tr key={task.taskId}>
                      <td>
                        <div className="task-id" title={task.taskId}>
                          <span className="task-id-prefix">#</span>{task.taskId}
                        </div>
                      </td>
                      {[...Array(maxRuns)].map((_, i) => {
                        const run = sortedRuns[i];
                        if (!run) return <td key={i}></td>;
                        
                        if (run.exists) {
                          totalScore += run.totalScore;
                          totalPossible += run.totalPossible;
                          validRunCount++;
                          const outputJsonUrl = `/data/${selectedBatch}/${task.taskId}/${run.run}/output.json`;
                          
                          return (
                            <td key={run.run}>
                              <div className="run-cell">
                                {/* Screenshot */}
                                {run.screenshot ? (
                                  <a href={run.screenshot} target="_blank" rel="noopener noreferrer" className="screenshot-link">
                                    <img 
                                      src={run.screenshot} 
                                      alt={`Run ${run.run}`} 
                                      className="screenshot"
                                    />
                                  </a>
                                ) : (
                                  <div className="no-image">No Image</div>
                                )}
                                
                                {/* Score */}
                                <a href={outputJsonUrl} target="_blank" rel="noopener noreferrer" className="score-link">
                                  <div className={`score-main ${getScoreColor(run.totalScore, run.totalPossible)}`}>
                                    {run.totalScore}/{run.totalPossible}
                                  </div>
                                  <div className="score-percentage">
                                    {formatPercentage(run.totalScore, run.totalPossible)}
                                  </div>
                                </a>
                                
                                {/* Basic & Aesthetic Scores */}
                                <div className="score-breakdown">
                                  <div className={`score-item ${getScoreColor(run.basicScore, run.basicTotal)}`}>
                                    B: {run.basicScore}/{run.basicTotal}
                                  </div>
                                  <div className={`score-item ${getScoreColor(run.aestheticScore, run.aestheticTotal)}`}>
                                    A: {run.aestheticScore}/{run.aestheticTotal}
                                  </div>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        
                        return (
                          <td key={run.run}>
                            <div className="run-cell">
                              <div className="no-image">No Image</div>
                              <span className="error-badge">ERROR</span>
                            </div>
                          </td>
                        );
                      })}
                      <td className="average-col">
                        {validRunCount > 0 ? (
                          <div className="average-cell">
                            <div className={`average-score ${getScoreColor(totalScore, totalPossible)}`}>
                              {(totalScore / validRunCount).toFixed(1)}/{(totalPossible / validRunCount).toFixed(1)}
                            </div>
                            <div className="average-percentage">
                              {formatPercentage(totalScore, totalPossible)}
                            </div>
                            <div className="average-runs">
                              ({validRunCount}R)
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#a0aec0' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {!loading && results.length === 0 && selectedBatch && !error && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <p className="empty-state-title">No results found</p>
            <p className="empty-state-subtitle">Try selecting a different batch</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

