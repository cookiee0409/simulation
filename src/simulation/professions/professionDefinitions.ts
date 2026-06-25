import type {
  BuildingType,
  ProfessionType,
  VillageNeed,
} from "../types";

/**
 * 직업 정의(데이터 기반). 코드에 조건문을 늘리지 않고 이 표를 확장해
 * 새 직업을 추가할 수 있다. 1차(농부·벌목꾼·채석공)와 2차(목수·대장장이·상인)를 정의한다.
 */
export interface ProfessionDefinition {
  id: ProfessionType;
  label: string;
  relatedNeeds: VillageNeed[];
  /** 이 직업이 일하려면 존재해야 하는(없으면 건설을 요청하는) 작업장. */
  requiredBuildingTypes: BuildingType[];
  /** 이 직업이 창발하려면 먼저 존재해야 하는 선행 직업. */
  requiredProfessions: ProfessionType[];
  /** 창발 시 새로 짓는 작업장(없을 때 건설 요청). */
  targetBuildingType?: BuildingType;
  /** 주민 적성 평가에 쓰는 특성 키. */
  aptitudeTrait: "cooperation" | "riskTolerance" | "savingPreference";
  /** 인구 대비 이 직업의 최대 비율(과잉 전직 방지). */
  maxPopulationRatio: number;
}

export const PROFESSION_DEFINITIONS: readonly ProfessionDefinition[] = [
  {
    id: "farmer",
    label: "농부",
    relatedNeeds: ["food"],
    requiredBuildingTypes: ["farm"],
    requiredProfessions: [],
    aptitudeTrait: "cooperation",
    maxPopulationRatio: 0.55,
  },
  {
    id: "lumberjack",
    label: "벌목꾼",
    relatedNeeds: ["wood"],
    requiredBuildingTypes: ["lumberjack"],
    requiredProfessions: [],
    aptitudeTrait: "riskTolerance",
    maxPopulationRatio: 0.15,
  },
  {
    id: "miner",
    label: "채석공",
    relatedNeeds: ["stone"],
    requiredBuildingTypes: ["quarry"],
    requiredProfessions: [],
    aptitudeTrait: "savingPreference",
    maxPopulationRatio: 0.12,
  },
  {
    id: "carpenter",
    label: "목수",
    relatedNeeds: ["shelter", "wood"],
    requiredBuildingTypes: ["carpentry"],
    requiredProfessions: ["lumberjack"],
    targetBuildingType: "carpentry",
    aptitudeTrait: "cooperation",
    maxPopulationRatio: 0.12,
  },
  {
    id: "blacksmith",
    label: "대장장이",
    relatedNeeds: ["tools", "stone"],
    requiredBuildingTypes: ["blacksmith"],
    requiredProfessions: ["miner"],
    targetBuildingType: "blacksmith",
    aptitudeTrait: "savingPreference",
    maxPopulationRatio: 0.1,
  },
  {
    id: "merchant",
    label: "상인",
    relatedNeeds: ["trade"],
    requiredBuildingTypes: ["market"],
    requiredProfessions: ["farmer"],
    targetBuildingType: "market",
    aptitudeTrait: "riskTolerance",
    maxPopulationRatio: 0.1,
  },
];

export function professionLabel(id: ProfessionType): string {
  return PROFESSION_DEFINITIONS.find((p) => p.id === id)?.label ?? id;
}
