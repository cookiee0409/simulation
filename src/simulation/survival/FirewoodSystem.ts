import type { SimulationState } from "../types";
import { WINTER_BALANCE } from "../scenarios/mountainWinter/winterBalance";

export function convertWoodToFirewood(
  state: SimulationState,
  amount: number,
): number {
  const converted = Math.min(Math.max(0, amount), state.resources.wood);
  state.resources.wood -= converted;
  state.resources.firewood +=
    converted * WINTER_BALANCE.firewoodConversionRate;
  return converted;
}
