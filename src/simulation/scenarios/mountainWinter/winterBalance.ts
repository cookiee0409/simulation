export const WINTER_BALANCE = {
  dailyFirewoodPerHeatedBuilding: 2.4,
  insulationConsumptionReduction: 0.65,
  occupantHeatBonus: 0.18,
  indoorHeatGainPerFirewood: 4.5,
  indoorTemperatureLag: 0.55,
  outdoorColdExposurePerTick: 0.012,
  indoorRecoveryPerTick: 0.025,
  hypothermiaHealthLossPerDay: 2.8,
  severeHypothermiaHealthLossPerDay: 7,
  illnessRecoveryWithCare: 9,
  repairWoodCost: 3,
  repairStoneCost: 1,
  insulationWoodCost: 4,
  firewoodConversionRate: 1,
  repairAmount: 18,
  insulationAmount: 12,
  minimumMigrationDay: 4,
  migrationExit: { x: 720, y: 260 },

  // 겨울엔 나무가 곧 땔감이라 늘 부족하고, 돌은 상대적으로 남는다.
  // 그래서 대장간·교역소는 남는 돌을 활용한다(수리용 최소 돌은 남겨 둠).
  stoneReserveForRepair: 9,

  // 대장간(forge): 돌을 소비해 도구를 만든다. 도구는 땔감 가공·수리 효율을 높인다.
  forgeStoneCost: 1.4,
  forgeToolsPerAction: 1.3,
  toolsStockCap: 16,
  toolFirewoodBonus: 0.45, // 도구 가득일 때 땔감 가공 +45%
  toolRepairBonus: 0.4, // 도구 가득일 때 수리량 +40%
  toolWearPerUse: 0.12, // 도구 사용 시 마모

  // 교역소(trade): 남는 돌을 외부 행상과 교환해 식량·땔감·의약품을 들여온다.
  tradeStoneGiven: 4,
  tradeFoodGained: 8,
  tradeFirewoodGained: 4.5,
  tradeMedicineGained: 0.4,
  tradeSurplusStoneFloor: 14, // 이 이상 돌이 남을 때만 교역
} as const;
