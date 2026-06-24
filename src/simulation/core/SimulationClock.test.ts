import { describe, expect, it } from "vitest";
import { SimulationClock } from "./SimulationClock";

describe("SimulationClock", () => {
  it("일시정지 중에는 틱이 준비되지 않는다", () => {
    const clock = new SimulationClock(100, 144, 10);
    expect(clock.consumeElapsed(5_000)).toBe(0);
    expect(clock.getTick()).toBe(0);
  });

  it("렌더 시간과 배속을 시뮬레이션 틱으로 변환한다", () => {
    const clock = new SimulationClock(100, 4, 10);
    clock.setPaused(false);
    clock.setSpeed(5);

    expect(clock.consumeElapsed(50)).toBe(2);
    expect(clock.advanceTick()).toMatchObject({
      tick: 1,
      day: 0,
      tickInDay: 1,
      completedDay: false,
    });
    expect(clock.advanceTick()).toMatchObject({
      tick: 2,
      day: 0,
      tickInDay: 2,
    });
    clock.advanceTick();
    expect(clock.advanceTick()).toMatchObject({
      tick: 4,
      day: 1,
      tickInDay: 0,
      completedDay: true,
    });
  });
});
