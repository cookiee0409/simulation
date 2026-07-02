import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import { recordMemory } from "../life/LifeStorySystem";
import type {
  ScenarioEvent,
  ScenarioOutcome,
  ScenarioRuntimeState,
  SimulationState,
} from "../types";
import type { ScenarioDefinition } from "./ScenarioDefinition";

export function createScenarioRuntime(
  definition: ScenarioDefinition,
): ScenarioRuntimeState {
  return {
    scenarioId: definition.id,
    currentDay: 0,
    durationDays: definition.durationDays,
    phase: "preparation",
    currentTemperature: definition.temperatureSchedule.initialTemperature,
    apparentTemperature: definition.temperatureSchedule.initialTemperature,
    expectedMinimumTemperature: definition.temperatureSchedule.finalTemperature,
    minimumTemperature: definition.temperatureSchedule.initialTemperature,
    snowDepth: 0,
    windStrength: 5,
    winterStartDay: definition.preparationDays,
    daysUntilWinter: definition.preparationDays,
    villageHeatSecurity: 0,
    foodSecurityDays: 0,
    firewoodSecurityDays: 0,
    agricultureProductivity: 1,
    outdoorRisk: 0,
    initialPopulation: definition.initialPopulation,
    deaths: 0,
    migrated: 0,
    careActions: 0,
    repairsCompleted: 0,
    insulationUpgrades: 0,
    minimumFood: definition.initialResources.food ?? 0,
    minimumFirewood: definition.initialResources.firewood ?? 0,
    events: [],
  };
}

export function updateScenarioDay(
  state: SimulationState,
  config: SimulationConfig,
  definition: ScenarioDefinition,
  day: number,
  random: SeededRandom,
): void {
  const runtime = state.scenario;
  if (!runtime || runtime.phase === "ended") {
    return;
  }

  const progress = Math.min(1, day / Math.max(1, definition.durationDays));
  runtime.currentDay = day;
  const trend =
    definition.temperatureSchedule.initialTemperature +
    (definition.temperatureSchedule.finalTemperature -
      definition.temperatureSchedule.initialTemperature) *
      smoothStep(progress);
  let weatherTemperature = 0;
  let wind = 4 + random.between(0, 9);
  let snow = Math.max(0, runtime.snowDepth * 0.88);
  let severeWeather = false;

  for (const rule of definition.weatherRules) {
    if (day >= rule.minimumDay && random.chance(rule.probability)) {
      weatherTemperature += rule.temperatureModifier;
      wind += rule.windModifier;
      snow += rule.snowModifier;
      severeWeather = true;
    }
  }

  runtime.currentTemperature =
    trend +
    random.between(
      -definition.temperatureSchedule.dailyVariation,
      definition.temperatureSchedule.dailyVariation,
    ) +
    weatherTemperature;
  runtime.windStrength = Math.max(0, wind);
  runtime.snowDepth = Math.max(
    0,
    snow + (runtime.currentTemperature < 1 ? random.between(0, 2.5) : -1),
  );
  runtime.apparentTemperature =
    runtime.currentTemperature - runtime.windStrength * 0.11;
  runtime.minimumTemperature = Math.min(
    runtime.minimumTemperature,
    runtime.currentTemperature,
  );
  runtime.daysUntilWinter = Math.max(0, definition.preparationDays - day);
  runtime.phase =
    day >= definition.preparationDays ? "winter" : "preparation";
  runtime.agricultureProductivity = Math.max(
    0.04,
    Math.min(1, (runtime.currentTemperature + 8) / 15),
  );
  runtime.outdoorRisk = clamp(
    (-runtime.apparentTemperature * 2.2 +
      runtime.windStrength * 0.65 +
      runtime.snowDepth * 0.5) /
      100,
    0,
    1,
  );

  if (day === definition.preparationDays) {
    recordScenarioEvent(state, {
      type: "winter_started",
      day,
      title: "혹한기가 시작되었습니다",
      description: "농업 생산이 급감하고 야외 활동 위험이 커졌습니다.",
      severity: "critical",
    });
  } else if (severeWeather && runtime.currentTemperature < -5) {
    recordScenarioEvent(state, {
      type: "cold_snap",
      day,
      title: "강한 한파",
      description: `체감 온도 ${runtime.apparentTemperature.toFixed(1)}°C의 한파가 닥쳤습니다.`,
      severity: "warning",
    });
  }

  const population = state.citizens.length;
  runtime.foodSecurityDays =
    population > 0 ? state.resources.food / (population * config.foodPerCitizenPerDay) : 0;
  const heatedBuildings = state.buildings.filter(
    (building) =>
      (building.type === "house" || building.type === "warehouse") &&
      building.constructionProgress >= 100,
  ).length;
  const dailyFirewoodDemand = Math.max(0.1, heatedBuildings * 1.8);
  runtime.firewoodSecurityDays = state.resources.firewood / dailyFirewoodDemand;
  runtime.villageHeatSecurity = clamp(
    (runtime.firewoodSecurityDays / Math.max(1, definition.durationDays - day)) *
      100,
    0,
    100,
  );
  runtime.minimumFood = Math.min(runtime.minimumFood, state.resources.food);
  runtime.minimumFirewood = Math.min(
    runtime.minimumFirewood,
    state.resources.firewood,
  );

}

export function finalizeScenarioDay(
  state: SimulationState,
  definition: ScenarioDefinition,
  day: number,
): ScenarioOutcome | undefined {
  const runtime = state.scenario;
  if (!runtime || runtime.phase === "ended") {
    return runtime?.outcome;
  }
  runtime.minimumFood = Math.min(runtime.minimumFood, state.resources.food);
  runtime.minimumFirewood = Math.min(
    runtime.minimumFirewood,
    state.resources.firewood,
  );
  if (day >= definition.durationDays || state.citizens.length === 0) {
    return finishScenario(state, definition, day);
  }
  return undefined;
}

export function recordScenarioEvent(
  state: SimulationState,
  event: Omit<ScenarioEvent, "id">,
): void {
  if (!state.scenario) {
    return;
  }
  const duplicate = state.scenario.events.some(
    (existing) =>
      existing.type === event.type &&
      existing.day === event.day &&
      existing.citizenId === event.citizenId &&
      existing.buildingId === event.buildingId,
  );
  if (duplicate) {
    return;
  }
  state.scenario.events.push({
    ...event,
    id: `scenario-event-${String(state.scenario.events.length + 1).padStart(3, "0")}`,
  });
}

function finishScenario(
  state: SimulationState,
  definition: ScenarioDefinition,
  day: number,
): ScenarioOutcome {
  const runtime = state.scenario!;
  runtime.phase = "ended";
  const survivors = state.citizens.length;
  const vulnerableAtStart = Math.max(
    1,
    Math.round(definition.initialPopulation * 0.34),
  );
  const vulnerableSurvivors = state.citizens.filter(
    (citizen) => citizen.age < 15 || citizen.age >= 60,
  ).length;
  const reason: ScenarioOutcome["reason"] =
    survivors === 0
      ? runtime.migrated >= runtime.initialPopulation
        ? "all_migrated"
        : "all_dead_or_left"
      : "winter_survived";
  runtime.outcome = {
    reason,
    initialPopulation: runtime.initialPopulation,
    survivors,
    deaths: runtime.deaths,
    migrated: runtime.migrated,
    sickResidents: state.citizens.filter(
      (citizen) => citizen.winter.illness >= 40,
    ).length,
    minimumTemperature: runtime.minimumTemperature,
    minimumFood: runtime.minimumFood,
    minimumFirewood: runtime.minimumFirewood,
    vulnerableSurvivalRate: Math.min(1, vulnerableSurvivors / vulnerableAtStart),
    repairsCompleted: runtime.repairsCompleted,
    insulationUpgrades: runtime.insulationUpgrades,
    careActions: runtime.careActions,
  };
  for (const citizen of state.citizens) {
    recordMemory(
      citizen,
      day,
      "winter_survived",
      "혹독한 겨울에서 살아남았다",
      "good",
    );
  }
  recordScenarioEvent(state, {
    type: "winter_ended",
    day,
    title: "생존 실험 종료",
    description: `${runtime.initialPopulation}명 중 ${survivors}명이 마을에 남아 생존했습니다.`,
    severity: survivors > 0 ? "positive" : "critical",
  });
  return runtime.outcome;
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
