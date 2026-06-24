import {
  MINUTES_PER_TICK,
  TICKS_PER_DAY,
} from "./SimulationConfig";

export const SIMULATION_SPEEDS = [1, 5, 20, 100] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export interface TickAdvance {
  tick: number;
  day: number;
  tickInDay: number;
  completedDay: boolean;
}

export class SimulationClock {
  private elapsedMilliseconds = 0;
  private paused = true;
  private speed: SimulationSpeed = 1;
  private tick = 0;

  constructor(
    private readonly millisecondsPerTick = 120,
    private readonly ticksPerDay = TICKS_PER_DAY,
    private readonly minutesPerTick = MINUTES_PER_TICK,
  ) {
    if (millisecondsPerTick <= 0 || ticksPerDay <= 0) {
      throw new RangeError("clock intervals must be positive");
    }
  }

  consumeElapsed(realDeltaMilliseconds: number): number {
    if (this.paused || realDeltaMilliseconds <= 0) {
      return 0;
    }
    this.elapsedMilliseconds += realDeltaMilliseconds * this.speed;
    const readyTicks = Math.floor(
      this.elapsedMilliseconds / this.millisecondsPerTick,
    );
    this.elapsedMilliseconds -= readyTicks * this.millisecondsPerTick;
    return readyTicks;
  }

  advanceTick(): TickAdvance {
    this.tick += 1;
    return {
      tick: this.tick,
      day: this.getDay(),
      tickInDay: this.getTickInDay(),
      completedDay: this.tick % this.ticksPerDay === 0,
    };
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setSpeed(speed: SimulationSpeed): void {
    if (!SIMULATION_SPEEDS.includes(speed)) {
      throw new RangeError(`Unsupported simulation speed: ${speed}`);
    }
    this.speed = speed;
  }

  getTick(): number {
    return this.tick;
  }

  getDay(): number {
    return Math.floor(this.tick / this.ticksPerDay);
  }

  getTickInDay(): number {
    return this.tick % this.ticksPerDay;
  }

  getMinuteOfDay(): number {
    return this.getTickInDay() * this.minutesPerTick;
  }

  getSpeed(): SimulationSpeed {
    return this.speed;
  }

  isPaused(): boolean {
    return this.paused;
  }
}
