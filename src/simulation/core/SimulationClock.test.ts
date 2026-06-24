import { describe, expect, it } from "vitest";
import { SimulationClock } from "./SimulationClock";

describe("SimulationClock", () => {
  it("일시정지 중에는 시간이 진행되지 않는다", () => {
    const clock = new SimulationClock(1_000);
    expect(clock.consumeElapsed(5_000)).toBe(0);
    expect(clock.getDay()).toBe(0);
  });

  it("렌더링 경과 시간과 배속을 날짜 진행량으로 변환한다", () => {
    const clock = new SimulationClock(1_000);
    clock.setPaused(false);
    clock.setSpeed(5);

    expect(clock.consumeElapsed(450)).toBe(2);
    expect(clock.advanceDay()).toBe(1);
    expect(clock.advanceDay()).toBe(2);
    expect(clock.consumeElapsed(150)).toBe(1);
  });
});
