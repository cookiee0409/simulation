import type { SimulationConfig } from "../core/SimulationConfig";
import type {
  Building,
  NeedState,
  SimulationState,
  VillageNeed,
} from "../types";

/**
 * 마을과 주민에서 발생하는 수요를 매일 계산한다. 각 수요는 미충족량·긴급도·추세·
 * 지속일을 누적해 직업 창발(ProfessionEmergenceSystem)의 입력이 된다.
 * 이 단계에서는 food·shelter·wood·stone 수요를 다룬다(나머지는 후속 단계).
 */
export function updateNeeds(
  state: SimulationState,
  config: SimulationConfig,
): NeedState[] {
  const previous = new Map(state.needs.map((need) => [need.type, need]));
  const next: NeedState[] = [
    computeFood(state, config),
    computeShelter(state, config),
    computeWood(state, config),
    computeStone(state, config),
    computeTools(state, config),
    computeTrade(state, config),
  ];

  for (const need of next) {
    const prior = previous.get(need.type);
    need.trend = trendOf(prior?.unmetDemand ?? 0, need.unmetDemand);
    need.sustainedDays =
      need.urgency >= 40 ? (prior?.sustainedDays ?? 0) + 1 : 0;
  }

  state.needs = next;
  return next;
}

export function topNeed(needs: NeedState[]): NeedState | undefined {
  return [...needs].sort((a, b) => b.urgency - a.urgency)[0];
}

function computeFood(
  state: SimulationState,
  config: SimulationConfig,
): NeedState {
  const population = state.citizens.length;
  const demand = population * config.foodPerCitizenPerDay;
  const stock = state.resources.food;
  const ableSettlers = state.citizens.filter(
    (c) => c.job === "settler" && c.canWork,
  ).length;
  const farmers = state.citizens.filter((c) => c.job === "farmer").length;
  // 채집 잠재 공급은 야생 식량 한계로 상한 처리(인구가 늘면 농업이 필요해짐).
  const foragePerDay = Math.min(
    config.wildFoodPerDay,
    ableSettlers *
      config.forageFoodPerAction *
      ((config.ticksPerDay / config.forageActionTicks) * 0.45),
  );
  // 농부 실효 산출은 이동·운반·식사·휴식 때문에 이론치보다 크게 낮다(보수적 추정).
  // 낮게 잡을수록 인구 대비 더 많은 농부가 창발해 식량이 인구를 따라간다.
  const farmPerDay =
    farmers *
    config.farmFoodPerAction *
    ((config.ticksPerDay / config.farmActionTicks) * 0.62);
  const supply = foragePerDay + farmPerDay;
  // 30% 식량 여유를 목표로 한다 → 인구가 늘면 농부가 계속 추가로 창발한다.
  const target = demand * 1.3;
  const selfSufficiency = target === 0 ? 1 : supply / target;
  const stockUrgency = clamp01(1 - stock / Math.max(1, demand * 3)) * 100;
  const supplyUrgency = clamp01((1 - selfSufficiency) * 2.2) * 100;
  const urgency = Math.max(stockUrgency, supplyUrgency);
  return {
    type: "food",
    currentDemand: round(demand),
    currentSupply: round(supply),
    unmetDemand: round(Math.max(0, demand - supply)),
    urgency: round(urgency),
    trend: "stable",
    sustainedDays: 0,
    causes: [
      { factor: "재고 부족", weight: round(stockUrgency) },
      { factor: "생산 자급 부족", weight: round(supplyUrgency) },
    ],
  };
}

function computeShelter(
  state: SimulationState,
  config: SimulationConfig,
): NeedState {
  const population = state.citizens.length;
  const capacity = completed(state, "house").reduce(
    (sum, h) => sum + h.capacity,
    0,
  );
  const unmet = Math.max(0, population + config.housingGrowthBuffer - capacity);
  const urgency = population === 0 ? 0 : clamp01(unmet / population) * 100;
  return {
    type: "shelter",
    currentDemand: population + config.housingGrowthBuffer,
    currentSupply: capacity,
    unmetDemand: unmet,
    urgency: round(urgency),
    trend: "stable",
    sustainedDays: 0,
    causes: [{ factor: "주택 수용력 부족", weight: round(urgency) }],
  };
}

function computeWood(
  state: SimulationState,
  config: SimulationConfig,
): NeedState {
  const sites = state.buildings.filter(
    (b) => b.type === "house" && b.constructionProgress < 100,
  ).length;
  const demand = config.houseWoodCost * (sites + 1);
  const supply = state.resources.wood;
  const unmet = Math.max(0, demand - supply);
  const urgency = clamp01(1 - supply / Math.max(1, config.woodStockTarget)) * 100;
  return {
    type: "wood",
    currentDemand: demand,
    currentSupply: round(supply),
    unmetDemand: round(unmet),
    urgency: round(urgency),
    trend: "stable",
    sustainedDays: 0,
    causes: [{ factor: "건설 자재 비축 부족", weight: round(urgency) }],
  };
}

function computeStone(
  state: SimulationState,
  config: SimulationConfig,
): NeedState {
  const supply = state.resources.stone;
  const urgency =
    clamp01(1 - supply / Math.max(1, config.stoneStockTarget)) * 100;
  return {
    type: "stone",
    currentDemand: config.stoneStockTarget,
    currentSupply: round(supply),
    unmetDemand: round(Math.max(0, config.stoneStockTarget - supply)),
    urgency: round(urgency),
    trend: "stable",
    sustainedDays: 0,
    causes: [{ factor: "석재 비축 부족", weight: round(urgency) }],
  };
}

function computeTools(
  state: SimulationState,
  config: SimulationConfig,
): NeedState {
  // 1차 생산 노동자가 많을수록 도구 수요가 커진다.
  const toolUsers = state.citizens.filter(
    (c) => c.job === "farmer" || c.job === "lumberjack" || c.job === "miner",
  ).length;
  const demand = toolUsers;
  const supply = state.resources.tools;
  const hasMiner = state.citizens.some((c) => c.job === "miner");
  // 도구 수요는 채굴 기반이 있을 때만 의미가 있다(요청서: 광물 없으면 대장장이 미등장).
  const base =
    toolUsers >= 4 ? clamp01(1 - supply / Math.max(1, demand)) * 100 : 0;
  const urgency = hasMiner ? base : Math.min(base, 15);
  return {
    type: "tools",
    currentDemand: demand,
    currentSupply: round(supply),
    unmetDemand: round(Math.max(0, demand - supply)),
    urgency: round(urgency),
    trend: "stable",
    sustainedDays: 0,
    causes: [{ factor: "도구 사용 노동 증가", weight: round(urgency) }],
  };
}

function computeTrade(
  state: SimulationState,
  config: SimulationConfig,
): NeedState {
  // 두 종류 이상의 잉여 상품이 쌓이면 교환(시장) 수요가 생긴다.
  const surpluses = [
    state.resources.food - state.citizens.length * config.foodPerCitizenPerDay * 3,
    state.resources.wood - config.woodStockTarget * 0.6,
    state.resources.stone - config.stoneStockTarget * 0.6,
    state.resources.tools - config.toolsStockTarget * 0.5,
  ].filter((value) => value > 0);
  const surplusKinds = surpluses.length;
  // 잉여 상품이 하나라도 쌓이면 교환 수요가 생기고, 종류가 많을수록 커진다.
  const urgency =
    surplusKinds >= 1 ? Math.min(100, 30 + surplusKinds * 16) : 0;
  return {
    type: "trade",
    currentDemand: surplusKinds,
    currentSupply: state.buildings.some(
      (b) => b.type === "market" && b.constructionProgress >= 100,
    )
      ? 1
      : 0,
    unmetDemand: surplusKinds,
    urgency: round(urgency),
    trend: "stable",
    sustainedDays: 0,
    causes: [{ factor: "잉여 상품 교환 수요", weight: round(urgency) }],
  };
}

function completed(state: SimulationState, type: Building["type"]): Building[] {
  return state.buildings.filter(
    (b) => b.type === type && b.constructionProgress >= 100,
  );
}

function trendOf(
  previous: number,
  current: number,
): NeedState["trend"] {
  if (current > previous + 0.5) return "rising";
  if (current < previous - 0.5) return "falling";
  return "stable";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export type { VillageNeed };
