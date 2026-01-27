// Utility functions for telemetry math: task completion and robot health
export function computeRobotHealth(batteryPct) {
  // batteryPct: 0-100
  const pct = Math.max(0, Math.min(100, Number(batteryPct) || 0));
  const score = +(pct / 100).toFixed(3); // 0.0 - 1.0

  let label = "Unknown";
  if (pct >= 70) label = "Good";
  else if (pct >= 40) label = "Fair";
  else if (pct >= 15) label = "Low";
  else label = "Critical";

  return { score, label, pct };
}

export function computeTaskCompletion(task = {}) {
  // Accepts multiple possible inputs. Priority order:
  // 1) explicit task.progress (0-100)
  // 2) distances: initialDistance and remainingDistance
  // 3) steps: stepsCompleted / totalSteps

  if (!task) return 0;

  const progressProvided =
    typeof task.progress === "number" && isFinite(task.progress);
  if (progressProvided) return Math.max(0, Math.min(100, task.progress));

  // Distance-based completion
  const initialDistance = Number(
    task.initialDistance || task.totalDistance || 0,
  );
  const remainingDistance = Number(task.remainingDistance || 0);

  let distanceScore = null;
  if (initialDistance > 0) {
    distanceScore =
      1 -
      Math.max(0, Math.min(initialDistance, remainingDistance)) /
        initialDistance;
  }

  // Steps-based completion
  const stepsCompleted = Number(task.stepsCompleted || 0);
  const totalSteps = Number(task.totalSteps || 0);
  let stepsScore = null;
  if (totalSteps > 0) {
    stepsScore = Math.max(0, Math.min(1, stepsCompleted / totalSteps));
  }

  // Combine available scores. Prefer distance if available, else steps.
  let combined = 0;
  if (distanceScore !== null && stepsScore !== null) {
    // Weighted combine: 70% distance, 30% steps
    combined = 0.7 * distanceScore + 0.3 * stepsScore;
  } else if (distanceScore !== null) combined = distanceScore;
  else if (stepsScore !== null) combined = stepsScore;

  return Math.round(Math.max(0, Math.min(1, combined)) * 100);
}

// Expose formulas for documentation (helpers)
export const formulas = {
  robotHealth: "$health = \\frac{battery_{pct}}{100}$",
  taskCompletionDistance:
    "$completion = 1 - \\frac{remainingDistance}{initialDistance}$",
  taskCompletionCombined:
    "$completion = 0.7 \\cdot distanceScore + 0.3 \\cdot stepsScore$",
};
