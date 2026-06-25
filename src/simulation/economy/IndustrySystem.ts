import type { SimulationConfig } from "../core/SimulationConfig";
import type { SimulationState } from "../types";

/**
 * 직업·건물·자원을 잇는 생산망 효과. 가공 목재(목수)→건설 속도,
 * 도구(대장간)→1차 생산성, 시장(상인)→생활 수준(행복)으로 연결된다.
 */

/** 가동 중인 목공소(목수 보유)가 건설 속도를 높인다. */
export function constructionSpeedMultiplier(
  state: SimulationState,
  config: SimulationConfig,
): number {
  const carpenters = state.citizens.filter(
    (c) => c.job === "carpenter" && c.canWork,
  ).length;
  const hasWorkshop = state.buildings.some(
    (b) => b.type === "carpentry" && b.constructionProgress >= 100,
  );
  if (!hasWorkshop || carpenters === 0) {
    return 1;
  }
  return 1 + carpenters * config.carpenterConstructionBonus;
}

/** 도구 비축이 1차 생산(농업·벌목·채석)의 생산성을 높인다. */
export function toolProductivityMultiplier(
  state: SimulationState,
  config: SimulationConfig,
): number {
  if (config.toolsStockTarget <= 0) {
    return 1;
  }
  const ratio = Math.min(1, state.resources.tools / config.toolsStockTarget);
  return 1 + ratio * config.maxToolsProductivityBonus;
}

/** 가동 중인 시장이 마을 생활 수준(행복)을 끌어올린다. */
export function applyMarketDailyEffects(
  state: SimulationState,
  config: SimulationConfig,
): void {
  const merchants = state.citizens.filter(
    (c) => c.job === "merchant" && c.canWork,
  ).length;
  const hasMarket = state.buildings.some(
    (b) => b.type === "market" && b.constructionProgress >= 100,
  );
  if (!hasMarket || merchants === 0) {
    return;
  }
  for (const citizen of state.citizens) {
    citizen.happiness = Math.min(
      100,
      citizen.happiness + config.marketHappinessBonus,
    );
  }
}
