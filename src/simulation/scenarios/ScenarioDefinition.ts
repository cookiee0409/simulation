import type {
  BuildingType,
  ResourcePool,
  ScenarioOutcome,
} from "../types";

export interface TemperatureSchedule {
  initialTemperature: number;
  finalTemperature: number;
  dailyVariation: number;
}

export interface WeatherRule {
  id: string;
  minimumDay: number;
  probability: number;
  temperatureModifier: number;
  windModifier: number;
  snowModifier: number;
}

export interface ScenarioBuildingPreset {
  type: BuildingType;
  count: number;
}

export interface CitizenGenerationConfig {
  ageMin: number;
  ageMax: number;
  childRatio: number;
  elderRatio: number;
  skillVariance: number;
}

export type ScenarioActionType =
  | "logging"
  | "process_firewood"
  | "heating"
  | "food_production"
  | "food_transport"
  | "eat"
  | "repair_shelter"
  | "insulate_shelter"
  | "care_sick"
  | "rest"
  | "individual_migration";

export type ScenarioEndCondition =
  | "duration_complete"
  | "all_dead_or_left"
  | "village_abandoned"
  | "all_migrated";

export interface ScenarioDefinition {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  preparationDays: number;
  initialPopulation: number;
  initialResources: Partial<ResourcePool>;
  temperatureSchedule: TemperatureSchedule;
  weatherRules: WeatherRule[];
  initialBuildings: ScenarioBuildingPreset[];
  citizenGeneration: CitizenGenerationConfig;
  availableActions: ScenarioActionType[];
  endConditions: ScenarioEndCondition[];
}

export interface ScenarioRunResult {
  seed: string;
  outcome: ScenarioOutcome;
}
