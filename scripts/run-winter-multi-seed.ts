import {
  SimulationEngine,
  mountainWinterScenario,
} from "../src/simulation";

const count = Math.max(20, Number(process.argv[2] ?? 20));
const results = [];

for (let index = 1; index <= count; index += 1) {
  const seed = `mountain-winter-${String(index).padStart(3, "0")}`;
  const engine = new SimulationEngine({ seed }, mountainWinterScenario);
  engine.runDays(mountainWinterScenario.durationDays);
  const snapshot = engine.getSnapshot();
  const outcome = snapshot.scenario?.outcome;
  results.push({
    seed,
    survivors: outcome?.survivors ?? snapshot.citizens.length,
    deaths: outcome?.deaths ?? 0,
    migrated: outcome?.migrated ?? 0,
    minimumTemperature: round(outcome?.minimumTemperature ?? 0),
    minimumFood: round(outcome?.minimumFood ?? snapshot.resources.food),
    minimumFirewood: round(
      outcome?.minimumFirewood ?? snapshot.resources.firewood,
    ),
    repairs: outcome?.repairsCompleted ?? 0,
    insulation: outcome?.insulationUpgrades ?? 0,
    care: outcome?.careActions ?? 0,
  });
}

const totals = results.reduce(
  (sum, result) => ({
    survivors: sum.survivors + result.survivors,
    deaths: sum.deaths + result.deaths,
    migrated: sum.migrated + result.migrated,
  }),
  { survivors: 0, deaths: 0, migrated: 0 },
);

console.log(JSON.stringify({
  runs: count,
  averages: {
    survivors: round(totals.survivors / count),
    deaths: round(totals.deaths / count),
    migrated: round(totals.migrated / count),
  },
  results,
}, null, 2));

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
