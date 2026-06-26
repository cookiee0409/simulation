import { recordScenarioEvent } from "../scenarios/ScenarioSystem";
import { WINTER_BALANCE } from "../scenarios/mountainWinter/winterBalance";
import type { Building, SimulationState } from "../types";

export function repairBuilding(
  state: SimulationState,
  building: Building,
  day: number,
): boolean {
  if (
    state.resources.wood < WINTER_BALANCE.repairWoodCost ||
    state.resources.stone < WINTER_BALANCE.repairStoneCost
  ) {
    return false;
  }
  state.resources.wood -= WINTER_BALANCE.repairWoodCost;
  state.resources.stone -= WINTER_BALANCE.repairStoneCost;
  building.winter.structuralCondition = Math.min(
    100,
    building.winter.structuralCondition + WINTER_BALANCE.repairAmount,
  );
  building.condition = building.winter.structuralCondition;
  building.winter.repairProgress = 100;
  state.dailyMetrics.repairsCompleted += 1;
  if (state.scenario) {
    state.scenario.repairsCompleted += 1;
  }
  recordScenarioEvent(state, {
    type: "repair",
    day,
    title: "주택 보수 완료",
    description: `${building.id}의 구조 상태가 개선되었습니다.`,
    severity: "positive",
    buildingId: building.id,
  });
  return true;
}

export function insulateBuilding(
  state: SimulationState,
  building: Building,
  day: number,
): boolean {
  if (state.resources.wood < WINTER_BALANCE.insulationWoodCost) {
    return false;
  }
  state.resources.wood -= WINTER_BALANCE.insulationWoodCost;
  building.winter.insulation = Math.min(
    100,
    building.winter.insulation + WINTER_BALANCE.insulationAmount,
  );
  state.dailyMetrics.insulationUpgrades += 1;
  if (state.scenario) {
    state.scenario.insulationUpgrades += 1;
  }
  recordScenarioEvent(state, {
    type: "insulation",
    day,
    title: "단열 보강 완료",
    description: `${building.id}의 단열이 ${Math.round(building.winter.insulation)}까지 상승했습니다.`,
    severity: "positive",
    buildingId: building.id,
  });
  return true;
}
