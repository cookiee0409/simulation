import type {
  BuildingType,
  ProfessionType,
  VillageNeed,
} from "../types";

/**
 * 직업 정의(데이터 기반). 코드에 조건문을 늘리지 않고 이 표를 확장해
 * 새 직업을 추가할 수 있다. 이번 단계는 1차 직업(농부·벌목꾼·채석공)만 정의한다.
 */
export interface ProfessionDefinition {
  id: ProfessionType;
  label: string;
  relatedNeeds: VillageNeed[];
  /** 이 직업이 일하려면 존재해야 하는 작업장 종류. */
  requiredBuildingTypes: BuildingType[];
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
    aptitudeTrait: "cooperation",
    maxPopulationRatio: 0.55,
  },
  {
    id: "lumberjack",
    label: "벌목꾼",
    relatedNeeds: ["wood"],
    requiredBuildingTypes: ["lumberjack"],
    aptitudeTrait: "riskTolerance",
    maxPopulationRatio: 0.15,
  },
  {
    id: "miner",
    label: "채석공",
    relatedNeeds: ["stone"],
    requiredBuildingTypes: ["quarry"],
    aptitudeTrait: "savingPreference",
    maxPopulationRatio: 0.12,
  },
];

export function professionLabel(id: ProfessionType): string {
  return PROFESSION_DEFINITIONS.find((p) => p.id === id)?.label ?? id;
}
