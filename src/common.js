export function parseRunnerState(statusCode) {
  const RunnerStatus = {
    0: "Unknown",
    1: "🏗️ Creation queued",
    2: "🏗️ Created",
    3: "✅ Provisioned",
    4: "⏳ Processing",
    5: "💣 Deletion queued",
    6: "🪦  Deleted",
    7: "⚠️  Failure",
    8: "VanishedOnCloud",
    9: "🧹 Cleanup"
  };
  if (Object.prototype.hasOwnProperty.call(RunnerStatus, statusCode)) {
    return RunnerStatus[statusCode];
  }
  return "Unknown";  // Default case if status code is not found
}

export function parseJobState(statusCode) {
  const JobState = {
    0: "Unknown",
    1: "⏸️  Queued",
    2: "▶️  In Progress",
    3: "✅ Completed"
  };
  if (Object.prototype.hasOwnProperty.call(JobState, statusCode)) {
    return JobState[statusCode];
  }
  return "Unknown";  // Default case if status code is not found
}
