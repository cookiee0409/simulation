import { performance } from "node:perf_hooks";
import { SimulationEngine } from "../src/simulation";

const startedAt = performance.now();
const engine = new SimulationEngine({ seed: "headless-100-day-report" });
const initial = engine.getLatestStatistics();
const statistics = engine.runDays(100);
const final = statistics.at(-1);
const simulationElapsedMilliseconds = performance.now() - startedAt;

if (!final) {
  throw new Error("The 100-day simulation did not produce statistics.");
}

const replayStartedAt = performance.now();
const replay = new SimulationEngine({ seed: "headless-100-day-report" });
replay.runDays(100);
const reproducible =
  JSON.stringify(engine.getSnapshot().statistics) ===
  JSON.stringify(replay.getSnapshot().statistics);
const reproducibilityCheckElapsedMilliseconds =
  performance.now() - replayStartedAt;
const report = {
  seed: engine.config.seed,
  daysRun: final.day,
  ticksRun: engine.getSnapshot().tick,
  simulationElapsedMilliseconds: round(simulationElapsedMilliseconds),
  reproducibilityCheckElapsedMilliseconds: round(
    reproducibilityCheckElapsedMilliseconds,
  ),
  reproducible,
  initial: {
    population: initial.population,
    foodStock: initial.foodStock,
    farmers: initial.farmerCount,
    farms: initial.farmCount,
    houses: initial.houseCount,
    housingDemand: initial.housingDemand,
  },
  final: {
    population: final.population,
    foodStock: final.foodStock,
    averageHappiness: final.averageHappiness,
    averageHunger: final.averageHunger,
    farmers: final.farmerCount,
    farms: final.farmCount,
    houses: final.houseCount,
    housingDemand: final.housingDemand,
  },
  totals: {
    foodProduced: round(
      statistics.reduce((sum, day) => sum + day.foodProduced, 0),
    ),
    foodConsumed: round(
      statistics.reduce((sum, day) => sum + day.foodConsumed, 0),
    ),
    unmetFoodDemand: round(
      statistics.reduce((sum, day) => sum + day.unmetFoodDemand, 0),
    ),
    populationLost: statistics.reduce(
      (sum, day) => sum + day.populationLost,
      0,
    ),
    snapshots: statistics.length,
  },
  agents: {
    activitiesAtEnd: engine.getSnapshot().activitySummary,
    activeTasks: engine.getSnapshot().tasks.length,
  },
  pathfinding: engine.getSnapshot().pathfinding,
};

console.log(JSON.stringify(report, null, 2));

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
