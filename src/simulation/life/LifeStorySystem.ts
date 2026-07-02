import type { SeededRandom } from "../core/SeededRandom";
import type {
  Citizen,
  CitizenAspiration,
  CitizenDecisionReason,
  CitizenGoal,
  CitizenSkillName,
  CitizenSkills,
  CitizenTraits,
  LifeEvent,
  LifeEventType,
  SimulationState,
} from "../types";

/** 기억 보존 상한. 넘으면 오래된 것부터 잊는다. */
const MEMORY_LIMIT = 48;

const SURNAMES = [
  "김", "이", "박", "최", "정", "강", "조", "윤", "장", "임",
  "한", "오", "서", "신", "권", "황", "안", "송", "유", "홍",
];
const GIVEN_FIRST = [
  "하", "서", "지", "도", "은", "민", "예", "수", "시", "주",
  "태", "현", "재", "윤", "소", "다", "건", "세", "연", "찬",
];
const GIVEN_SECOND = [
  "준", "윤", "안", "우", "율", "원", "호", "랑", "빈", "결",
  "솔", "람", "온", "별", "담", "설", "경", "혁", "아", "인",
];

/** 시드 기반 결정적 한국어 이름 생성. */
export function createCitizenName(random: SeededRandom): string {
  return (
    random.pick(SURNAMES) +
    random.pick(GIVEN_FIRST) +
    random.pick(GIVEN_SECOND)
  );
}

const SKILL_MASTERY_LABELS: Record<CitizenSkillName, string> = {
  farming: "마을 제일의 농사꾼이 되는 것",
  logging: "숲을 다스리는 벌목장인이 되는 것",
  construction: "마을을 짓는 명장이 되는 것",
  hunting: "이름난 사냥꾼이 되는 것",
  medicine: "병을 다스리는 의원이 되는 것",
  cooking: "살림 솜씨로 이름나는 것",
  scouting: "산길을 꿰뚫는 길잡이가 되는 것",
  negotiation: "장사 수완으로 이름나는 것",
  leadership: "마을을 이끄는 어른이 되는 것",
};

/**
 * 성격·재능에서 인생 목표를 결정한다(결정적 — 같은 주민은 항상 같은 꿈).
 * 목표는 일상 선택에 지속적인 편향을 주고 일대기 패널에 표시된다.
 */
export function createAspiration(
  traits: CitizenTraits,
  skills: CitizenSkills,
  specialty: CitizenSkillName,
): CitizenAspiration {
  const scores: Array<{ aspiration: CitizenAspiration; score: number }> = [
    {
      aspiration: {
        type: "mastery",
        label: SKILL_MASTERY_LABELS[specialty],
        skill: specialty,
      },
      score: skills[specialty] * 0.6 + traits.patience * 0.2 + 18,
    },
    {
      aspiration: { type: "healer", label: "아픈 이웃을 지키는 것" },
      score: skills.medicine * 0.55 + traits.empathy * 0.45,
    },
    {
      aspiration: { type: "wealth", label: "큰 재산을 모으는 것" },
      score:
        skills.negotiation * 0.4 +
        traits.savingPreference * 0.35 +
        traits.selfishness * 0.25,
    },
    {
      aspiration: { type: "family", label: "따뜻한 집을 지키는 것" },
      score:
        traits.attachmentToVillage * 0.5 +
        traits.empathy * 0.28 +
        traits.patience * 0.22,
    },
    {
      aspiration: { type: "protector", label: "마을의 기둥이 되는 것" },
      score:
        traits.cooperation * 0.36 +
        traits.leadership * 0.36 +
        traits.ruleFollowing * 0.28,
    },
  ];
  return scores.sort(
    (left, right) =>
      right.score - left.score ||
      left.aspiration.type.localeCompare(right.aspiration.type),
  )[0]!.aspiration;
}

/** 같은 날 같은 종류의 기억은 한 번만 남긴다. */
export function recordMemory(
  citizen: Citizen,
  day: number,
  type: LifeEventType,
  label: string,
  sentiment: LifeEvent["sentiment"],
): void {
  if (
    citizen.memories.some(
      (memory) => memory.day === day && memory.type === type,
    )
  ) {
    return;
  }
  citizen.memories.push({ day, type, label, sentiment });
  if (citizen.memories.length > MEMORY_LIMIT) {
    citizen.memories = citizen.memories.slice(-MEMORY_LIMIT);
  }
}

export function hasMemorySince(
  citizen: Citizen,
  type: LifeEventType,
  sinceDay: number,
): boolean {
  return citizen.memories.some(
    (memory) => memory.type === type && memory.day >= sinceDay,
  );
}

export function lastMemoryDay(
  citizen: Citizen,
  type: LifeEventType,
): number {
  let latest = -1;
  for (const memory of citizen.memories) {
    if (memory.type === type && memory.day > latest) {
      latest = memory.day;
    }
  }
  return latest;
}

/**
 * 마을을 떠난(사망·이주) 주민을 한집 식구의 기억에 남긴다.
 * 관계망(Phase 2) 전이라 "같은 집"이 유일한 가족 단위다.
 */
export function recordHouseholdLoss(
  state: SimulationState,
  departed: Citizen,
  day: number,
  kind: "death" | "migration",
): void {
  if (!departed.homeId) {
    return;
  }
  for (const other of state.citizens) {
    if (other.id === departed.id || other.homeId !== departed.homeId) {
      continue;
    }
    if (kind === "death") {
      recordMemory(
        other,
        day,
        "lost_housemate",
        `한집 식구 ${departed.name}을(를) 잃었다`,
        "bad",
      );
    } else {
      recordMemory(
        other,
        day,
        "housemate_left",
        `${departed.name}이(가) 마을을 떠났다`,
        "bad",
      );
    }
  }
}

// --- 의사결정 편향: 기억과 꿈이 행동 점수에 남기는 흔적 ---

/** 식량 확보로 이어지는 행동. 굶주림의 기억이 여기에 가점을 준다. */
const FOOD_GOALS: ReadonlySet<CitizenGoal> = new Set([
  "eat",
  "work_farm",
  "forage",
  "carry_food",
]);

/** 인생 목표가 행동별로 주는 가점(±12 이내로 밸런스 보호). */
const ASPIRATION_GOAL_BONUS: Record<
  CitizenAspiration["type"],
  Partial<Record<CitizenGoal, number>>
> = {
  mastery: {},
  healer: { care_sick: 10, heat_home: 4 },
  wealth: { work_market: 8, trade_supplies: 8 },
  protector: { build: 6, heat_home: 6, care_sick: 4, gather_wood: 3 },
  family: { heat_home: 8, care_sick: 5 },
};

/** 장인의 꿈: 자기 전문 기술을 쓰는 작업에 가점. */
const SKILL_GOALS: Record<CitizenSkillName, CitizenGoal[]> = {
  farming: ["work_farm"],
  logging: ["gather_wood", "process_firewood"],
  construction: ["build", "work_carpentry", "work_blacksmith", "forge_tools", "gather_stone"],
  hunting: ["forage"],
  medicine: ["care_sick"],
  cooking: ["heat_home"],
  scouting: ["forage"],
  negotiation: ["work_market", "trade_supplies"],
  leadership: ["build"],
};

/** 최근일수록 강한 굶주림의 기억(0~12). */
export function starvationBias(citizen: Citizen, day: number): number {
  let score = 0;
  for (const memory of citizen.memories) {
    if (memory.type === "starvation") {
      score += day - memory.day <= 30 ? 4 : 2;
    }
  }
  return Math.min(12, score);
}

/** 앓아누웠던 기억(0~10). 휴식과 환자 돌봄에 민감해진다. */
export function illnessBias(citizen: Citizen, day: number): number {
  let score = 0;
  for (const memory of citizen.memories) {
    if (memory.type === "fell_ill" || memory.type === "was_cared") {
      score += day - memory.day <= 30 ? 4 : 2;
    }
  }
  return Math.min(10, score);
}

/** 식구를 잃은 기억(0~8). 남은 이들을 지키는 행동에 가점. */
export function griefBias(citizen: Citizen, day: number): number {
  let score = 0;
  for (const memory of citizen.memories) {
    if (memory.type === "lost_housemate") {
      score += day - memory.day <= 40 ? 4 : 2;
    }
  }
  return Math.min(8, score);
}

/**
 * 행동 후보에 덧붙는 개인적 이유(기억·꿈)의 리졸버. 기억 스캔은 결정당
 * 한 번만 수행하고, 후보별로는 goal 매핑만 조회한다. decisionReasons에
 * 노출되어 패널에서 "왜 이 일을 하는가"의 개인 서사로 보인다.
 */
export function createPersonalReasonResolver(
  citizen: Citizen,
  day: number,
): (goal: CitizenGoal) => CitizenDecisionReason[] {
  const hungry = starvationBias(citizen, day);
  const sick = illnessBias(citizen, day);
  const grief = griefBias(citizen, day);
  const aspiration = citizen.aspiration;

  return (goal) => {
    const reasons: CitizenDecisionReason[] = [];
    let dreamScore = ASPIRATION_GOAL_BONUS[aspiration.type][goal] ?? 0;
    if (
      aspiration.type === "mastery" &&
      aspiration.skill &&
      SKILL_GOALS[aspiration.skill].includes(goal)
    ) {
      dreamScore = 8;
    }
    if (dreamScore > 0) {
      reasons.push({ factor: `꿈: ${aspiration.label}`, score: dreamScore });
    }
    if (hungry > 0 && FOOD_GOALS.has(goal)) {
      reasons.push({ factor: "굶주렸던 기억", score: hungry });
    }
    if (sick > 0 && goal === "rest") {
      reasons.push({ factor: "앓아누웠던 기억", score: sick });
    }
    if (grief > 0 && (goal === "care_sick" || goal === "heat_home")) {
      reasons.push({ factor: "식구를 잃은 기억", score: grief });
    }
    return reasons;
  };
}
