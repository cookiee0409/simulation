import type { ScenarioDefinition } from "./ScenarioDefinition";
import { mountainWinterScenario } from "./mountainWinter/mountainWinterScenario";

const scenarios = new Map<string, ScenarioDefinition>([
  [mountainWinterScenario.id, mountainWinterScenario],
]);

export function getScenario(id: string): ScenarioDefinition | undefined {
  return scenarios.get(id);
}

export function listScenarios(): ScenarioDefinition[] {
  return [...scenarios.values()];
}
