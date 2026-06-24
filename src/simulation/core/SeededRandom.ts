/**
 * 시뮬레이션에서 사용하는 유일한 난수원입니다.
 * 문자열 시드를 32비트 상태로 바꾼 뒤 Mulberry32 알고리즘으로 값을 생성합니다.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = SeededRandom.hashSeed(String(seed));
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  integer(min: number, max: number): number {
    if (max < min) {
      throw new RangeError("max must be greater than or equal to min");
    }
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  between(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(probability: number): boolean {
    return this.next() < Math.min(1, Math.max(0, probability));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("Cannot pick from an empty array");
    }
    return items[this.integer(0, items.length - 1)] as T;
  }

  getState(): number {
    return this.state;
  }

  private static hashSeed(seed: string): number {
    let hash = 2_166_136_261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
  }
}
