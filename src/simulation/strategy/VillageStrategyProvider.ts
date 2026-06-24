export interface VillageStrategyContext {
  day: number;
  population: number;
  foodStock: number;
  housingDemand: number;
}

export interface VillageStrategyPlan {
  priorities: Array<{
    type: "food" | "housing" | "employment";
    weight: number;
  }>;
}

export interface VillageStrategyProvider {
  createPlan(
    context: VillageStrategyContext,
  ): Promise<VillageStrategyPlan>;
}

/** 외부 API 없이 현재 지표만 사용하는 향후 확장용 기본 전략 제공자. */
export class RuleBasedVillageStrategyProvider
  implements VillageStrategyProvider
{
  async createPlan(
    context: VillageStrategyContext,
  ): Promise<VillageStrategyPlan> {
    const foodPressure =
      context.population === 0
        ? 0
        : Math.max(0, 1 - context.foodStock / context.population);
    return {
      priorities: [
        { type: "food", weight: foodPressure },
        { type: "housing", weight: Math.min(1, context.housingDemand / 3) },
        { type: "employment", weight: 0.5 },
      ],
    };
  }
}
