import {
  SimulationEngine,
  mountainWinterScenario,
} from "../src/simulation";

const seed = process.argv[2] ?? "mountain-winter-001";
const engine = new SimulationEngine({ seed }, mountainWinterScenario);
engine.runDays(mountainWinterScenario.durationDays);
const snapshot = engine.getSnapshot();

console.log(JSON.stringify({
  seed,
  day: snapshot.day,
  phase: snapshot.scenario?.phase,
  population: snapshot.citizens.length,
  resources: {
    food: round(snapshot.resources.food),
    firewood: round(snapshot.resources.firewood),
    wood: round(snapshot.resources.wood),
    medicine: round(snapshot.resources.medicine),
  },
  outcome: snapshot.scenario?.outcome,
  events: snapshot.scenario?.events.length ?? 0,
}, null, 2));

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
