export const SIMULATION_SPEEDS = [1, 5, 20, 100] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export class SimulationClock {
  private elapsedMilliseconds = 0;
  private paused = true;
  private speed: SimulationSpeed = 1;
  private day = 0;

  constructor(private readonly millisecondsPerDay = 1_000) {
    if (millisecondsPerDay <= 0) {
      throw new RangeError("millisecondsPerDay must be positive");
    }
  }

  consumeElapsed(realDeltaMilliseconds: number): number {
    if (this.paused || realDeltaMilliseconds <= 0) {
      return 0;
    }

    this.elapsedMilliseconds += realDeltaMilliseconds * this.speed;
    const readyDays = Math.floor(
      this.elapsedMilliseconds / this.millisecondsPerDay,
    );
    this.elapsedMilliseconds -= readyDays * this.millisecondsPerDay;
    return readyDays;
  }

  advanceDay(): number {
    this.day += 1;
    return this.day;
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

  getDay(): number {
    return this.day;
  }

  getSpeed(): SimulationSpeed {
    return this.speed;
  }

  isPaused(): boolean {
    return this.paused;
  }
}
