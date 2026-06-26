import { describe, expect, it } from "vitest";
import { AgentExecutionSystem } from "../../agents/AgentExecutionSystem";
import { createSimulationConfig } from "../../core/SimulationConfig";
import { SimulationEngine } from "../../core/SimulationEngine";
import { SeededRandom } from "../../core/SeededRandom";
import { updateBodyTemperatures } from "../../survival/BodyTemperatureSystem";
import {
  insulationFirewoodDemand,
  updateHeating,
} from "../../survival/HeatingSystem";
import type { SimulationState } from "../../types";
import { mountainWinterScenario } from "./mountainWinterScenario";

describe("mountain winter scenario", () => {
  it("creates the requested population, resources, and buildings", () => {
    const snapshot = createWinterEngine("winter-setup").getSnapshot();

    expect(snapshot.citizens).toHaveLength(24);
    expect(snapshot.resources.food).toBe(190);
    expect(snapshot.resources.wood).toBe(85);
    expect(snapshot.resources.stone).toBe(40);
    expect(snapshot.resources.firewood).toBe(22);
    expect(snapshot.resources.medicine).toBe(6);
    expect(snapshot.buildings.filter((b) => b.type === "house")).toHaveLength(6);
    expect(snapshot.buildings.filter((b) => b.type === "warehouse")).toHaveLength(1);
    expect(snapshot.buildings.filter((b) => b.type === "farm")).toHaveLength(2);
    expect(snapshot.buildings.filter((b) => b.type === "lumberjack")).toHaveLength(1);
  });

  it("uses seeded weather and produces deterministic 55-day outcomes", () => {
    const first = createWinterEngine("winter-replay");
    const second = createWinterEngine("winter-replay");
    first.runDays(55);
    second.runDays(55);
    expect(first.getSnapshot()).toEqual(second.getSnapshot());

    const different = createWinterEngine("winter-replay-other");
    different.runDays(55);
    expect(different.getSnapshot().scenario?.minimumTemperature).not.toBe(
      first.getSnapshot().scenario?.minimumTemperature,
    );
  }, 30_000);

  it("changes phase on day 20 and finalizes an accounted outcome on day 55", () => {
    const engine = createWinterEngine("winter-phases");
    engine.runDays(19);
    expect(engine.getSnapshot().scenario?.phase).toBe("preparation");
    engine.stepDay();
    expect(engine.getSnapshot().scenario?.phase).toBe("winter");
    engine.runDays(35);
    const outcome = engine.getSnapshot().scenario?.outcome;
    expect(engine.getSnapshot().scenario?.phase).toBe("ended");
    expect(outcome).toBeDefined();
    expect(
      outcome!.survivors + outcome!.deaths + outcome!.migrated,
    ).toBe(24);
  }, 20_000);

  it("never allows negative fuel and performs winter work", () => {
    const engine = createWinterEngine("winter-resources");
    const goals = new Set<string>();
    for (let day = 0; day < 55; day += 1) {
      engine.stepDay();
      const snapshot = engine.getSnapshot();
      expect(snapshot.resources.firewood).toBeGreaterThanOrEqual(0);
      expect(snapshot.resources.wood).toBeGreaterThanOrEqual(0);
      for (const citizen of snapshot.citizens) {
        goals.add(citizen.goal);
      }
    }
    const outcome = engine.getSnapshot().scenario?.outcome;
    expect(outcome!.repairsCompleted).toBeGreaterThan(0);
    expect(outcome!.insulationUpgrades).toBeGreaterThan(0);
    expect(outcome!.careActions).toBeGreaterThan(0);
    expect(goals.has("work_farm")).toBe(true);
    expect(
      goals.has("gather_wood") || goals.has("process_firewood"),
    ).toBe(true);
  }, 20_000);

  it("heating protects body temperature and insulation reduces fuel demand", () => {
    const warmEngine = createWinterEngine("winter-heating");
    const coldEngine = createWinterEngine("winter-heating");
    const warm = internalState(warmEngine);
    const cold = internalState(coldEngine);
    prepareColdRoom(warm, 20);
    prepareColdRoom(cold, 0);

    updateHeating(warm);
    updateHeating(cold);
    for (let tick = 0; tick < 30; tick += 1) {
      updateBodyTemperatures(warm, createSimulationConfig());
      updateBodyTemperatures(cold, createSimulationConfig());
    }

    expect(warm.citizens[0]!.winter.bodyTemperature).toBeGreaterThan(
      cold.citizens[0]!.winter.bodyTemperature,
    );
    expect(insulationFirewoodDemand(80, -20)).toBeLessThan(
      insulationFirewoodDemand(20, -20),
    );
  });

  it("hunger and age increase outdoor cold vulnerability", () => {
    const engine = createWinterEngine("winter-vulnerability");
    const state = internalState(engine);
    state.scenario!.currentTemperature = -20;
    state.scenario!.apparentTemperature = -25;
    state.scenario!.outdoorRisk = 0.8;
    const vulnerable = state.citizens[0]!;
    const resilient = state.citizens[1]!;
    vulnerable.age = 70;
    vulnerable.hunger = 100;
    resilient.age = 30;
    resilient.hunger = 0;
    for (const citizen of [vulnerable, resilient]) {
      citizen.goal = "gather_wood";
      citizen.actionState = "moving";
      citizen.targetId = "lumberjack-01";
      citizen.winter.bodyTemperature = 36.7;
      citizen.winter.clothingWarmth = 10;
    }
    updateBodyTemperatures(state, createSimulationConfig());
    expect(vulnerable.winter.bodyTemperature).toBeLessThan(
      resilient.winter.bodyTemperature,
    );
  });

  it("supports an actual individual migration action", () => {
    const engine = createWinterEngine("winter-migration");
    const state = internalState(engine);
    const citizen = state.citizens[0]!;
    citizen.goal = "migrate";
    citizen.actionState = "performing";
    citizen.actionProgress = 0.99;
    const before = state.citizens.length;

    new AgentExecutionSystem().updateCitizen(
      citizen,
      state,
      createSimulationConfig(),
      30,
      new SeededRandom("migration"),
    );

    expect(state.citizens).toHaveLength(before - 1);
    expect(state.scenario?.migrated).toBe(1);
    expect(state.scenario?.events.some((event) => event.type === "migration")).toBe(true);
  });

  it("generates diverse skills and traits for utility decisions", () => {
    const citizens = createWinterEngine("winter-diversity").getSnapshot().citizens;
    expect(new Set(citizens.map((c) => c.skills.logging)).size).toBeGreaterThan(5);
    expect(
      new Set(citizens.map((c) => c.traits.attachmentToVillage)).size,
    ).toBeGreaterThan(5);
    expect(citizens.some((c) => c.skills.medicine >= 45)).toBe(true);
  });
});

function createWinterEngine(seed: string): SimulationEngine {
  return new SimulationEngine({ seed }, mountainWinterScenario);
}

function internalState(engine: SimulationEngine): SimulationState {
  return (engine as unknown as { state: SimulationState }).state;
}

function prepareColdRoom(state: SimulationState, firewood: number): void {
  state.scenario!.currentTemperature = -20;
  state.scenario!.apparentTemperature = -24;
  state.scenario!.outdoorRisk = 0.8;
  state.resources.firewood = firewood;
  const citizen = state.citizens[0]!;
  const house = state.buildings.find((building) => building.id === citizen.homeId)!;
  citizen.goal = "rest";
  citizen.actionState = "performing";
  citizen.targetId = house.id;
  citizen.winter.bodyTemperature = 35.5;
  house.winter.indoorTemperature = 5;
  house.winter.firewoodStored = 0;
}
