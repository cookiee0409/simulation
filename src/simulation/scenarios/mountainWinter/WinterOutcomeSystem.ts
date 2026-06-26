import type { ScenarioOutcome, ScenarioRuntimeState } from "../../types";

export function summarizeWinterOutcome(
  runtime: ScenarioRuntimeState,
): ScenarioOutcome | undefined {
  return runtime.outcome ? { ...runtime.outcome } : undefined;
}
