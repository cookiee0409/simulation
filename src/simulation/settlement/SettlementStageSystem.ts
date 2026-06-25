import type {
  Building,
  Citizen,
  SettlementStage,
  SimulationState,
} from "../types";

/** 생산 전문화를 상징하는 건물(마을 단계 이상에서 등장). */
const SPECIALIZED_BUILDINGS: Building["type"][] = [
  "carpentry",
  "blacksmith",
  "market",
];

/**
 * 마을 발전 단계는 직업을 여는 잠금장치가 아니라 현재 상태의 요약 결과값이다.
 * 인구·직업 다양성·건물 종류·식량 안정성을 종합해 판정한다.
 */
export function computeSettlementStage(
  state: SimulationState,
): SettlementStage {
  const population = state.citizens.length;
  const professions = distinctProfessions(state);
  const buildingTypes = distinctBuildingTypes(state);
  const hasSpecialized = state.buildings.some((b) =>
    SPECIALIZED_BUILDINGS.includes(b.type),
  );
  const foodUrgency = state.needs.find((n) => n.type === "food")?.urgency ?? 0;
  const stableFood = foodUrgency < 50;

  if (population >= 50 && professions >= 4 && hasSpecialized) {
    return "growing_village";
  }
  if (population >= 25 && professions >= 3 && hasSpecialized) {
    return "village";
  }
  if (
    (population >= 14 || professions >= 1) &&
    stableFood &&
    buildingTypes >= 3
  ) {
    return "hamlet";
  }
  return "camp";
}

export function distinctProfessions(state: SimulationState): number {
  const set = new Set<Citizen["job"]>();
  for (const citizen of state.citizens) {
    if (citizen.job !== "settler" && citizen.job !== "unemployed") {
      set.add(citizen.job);
    }
  }
  return set.size;
}

export function distinctBuildingTypes(state: SimulationState): number {
  const set = new Set<Building["type"]>();
  for (const building of state.buildings) {
    if (building.constructionProgress >= 100) {
      set.add(building.type);
    }
  }
  return set.size;
}

export const STAGE_LABELS: Record<SettlementStage, string> = {
  camp: "야영지",
  hamlet: "정착촌",
  village: "마을",
  growing_village: "성장 마을",
  town: "소도시",
};
