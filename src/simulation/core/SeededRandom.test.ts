import { describe, expect, it } from "vitest";
import { SeededRandom } from "./SeededRandom";

describe("SeededRandom", () => {
  it("같은 시드에서 같은 난수열을 만든다", () => {
    const first = new SeededRandom("same-seed");
    const second = new SeededRandom("same-seed");

    expect(Array.from({ length: 20 }, () => first.next())).toEqual(
      Array.from({ length: 20 }, () => second.next()),
    );
  });

  it("다른 시드는 다른 난수열을 만든다", () => {
    const first = new SeededRandom("seed-a");
    const second = new SeededRandom("seed-b");

    expect(first.next()).not.toBe(second.next());
  });
});
