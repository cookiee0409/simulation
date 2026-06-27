import type { ScenarioDefinition } from "../ScenarioDefinition";

export const mountainWinterScenario: ScenarioDefinition = {
  id: "mountain-winter",
  title: "혹한이 다가오는 산골 마을",
  description:
    "예상보다 이른 혹한이 오기 전 식량과 땔감을 마련하고 집을 보수해야 한다.",
  durationDays: 55,
  preparationDays: 20,
  initialPopulation: 24,
  initialResources: {
    food: 190,
    wood: 85,
    stone: 40,
    medicine: 6,
    firewood: 22,
    warm_clothing: 8,
  },
  temperatureSchedule: {
    initialTemperature: 7,
    finalTemperature: -24,
    dailyVariation: 3.2,
  },
  weatherRules: [
    {
      id: "early-cold-snap",
      minimumDay: 7,
      probability: 0.12,
      temperatureModifier: -5,
      windModifier: 12,
      snowModifier: 2,
    },
    {
      id: "blizzard",
      minimumDay: 20,
      probability: 0.16,
      temperatureModifier: -4,
      windModifier: 28,
      snowModifier: 8,
    },
  ],
  initialBuildings: [
    { type: "house", count: 6 },
    { type: "warehouse", count: 1 },
    { type: "farm", count: 2 },
    { type: "lumberjack", count: 1 },
  ],
  citizenGeneration: {
    ageMin: 8,
    ageMax: 72,
    childRatio: 0.17,
    elderRatio: 0.17,
    skillVariance: 24,
  },
  availableActions: [
    "logging",
    "process_firewood",
    "heating",
    "food_production",
    "food_transport",
    "eat",
    "care_sick",
    "rest",
    "individual_migration",
  ],
  endConditions: [
    "duration_complete",
    "all_dead_or_left",
    "village_abandoned",
    "all_migrated",
  ],
};
