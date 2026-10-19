import { describe, expect, it } from "vitest";
import { aggrieve, isTruce, RelationBook, restingStanding, settle, sideOf, stanceFor } from "./relations.ts";

describe("relations", () => {
  it("start neutral between strangers and friendly between kin", () => {
    const book = new RelationBook();

    const strangers = book.meet(1, 2, false);
    const kin = book.meet(3, 4, true);

    expect(strangers.stance).toBe("neutral");
    expect(kin.stance).toBe("friendly");
    expect(book.meet(2, 1, false)).toBe(strangers);
    expect(book.find(4, 3)).toBe(kin);
  });

  it("sour with each insult and remember who was wronged", () => {
    const relation = new RelationBook().meet(1, 2, false);

    aggrieve(relation, 2, 30, "hunting");

    expect(relation.standing).toBe(-30);
    expect(sideOf(relation, 2).grievance).toBe(30);
    expect(sideOf(relation, 1).grievance).toBe(0);
    expect(relation.lastGrudge).toBe("hunting");
  });

  it("turn hostile past a threshold and stay hostile until they warm well past it", () => {
    expect(stanceFor(-49, "wary")).toBe("wary");
    expect(stanceFor(-51, "wary")).toBe("hostile");
    expect(stanceFor(-40, "hostile")).toBe("hostile");
    expect(stanceFor(-30, "hostile")).toBe("wary");
    expect(stanceFor(31, "neutral")).toBe("friendly");
    expect(stanceFor(25, "friendly")).toBe("friendly");
    expect(stanceFor(10, "friendly")).toBe("neutral");
  });

  it("drift back toward their resting point as days pass", () => {
    const book = new RelationBook();

    const strangers = book.meet(1, 2, false);
    const kin = book.meet(3, 4, true);

    strangers.standing = -90;
    kin.standing = 90;
    settle(strangers, 10, 10);
    settle(kin, 10, 10);

    expect(strangers.standing).toBeGreaterThan(-90);
    expect(strangers.standing).toBeLessThan(restingStanding(strangers, 10) - 20);
    expect(kin.standing).toBeLessThan(90);
    expect(restingStanding(kin, 10)).toBeGreaterThan(restingStanding(strangers, 10));
  });

  it("rest warmer during a truce and forgive grievances slowly", () => {
    const relation = new RelationBook().meet(1, 2, false);

    relation.truceUntilDay = 5;
    aggrieve(relation, 1, 40, "plunder");
    settle(relation, 2, 3);

    expect(isTruce(relation, 3)).toBe(true);
    expect(isTruce(relation, 6)).toBe(false);
    expect(restingStanding(relation, 3)).toBeGreaterThan(restingStanding(relation, 6));
    expect(sideOf(relation, 1).grievance).toBeLessThan(40);
    expect(sideOf(relation, 1).grievance).toBeGreaterThan(20);
  });

  it("forget tribes that are gone", () => {
    const book = new RelationBook();

    book.meet(1, 2, false);
    book.meet(1, 3, false);
    book.meet(2, 3, false);
    book.forgetTribe(1);

    expect(book.all).toHaveLength(1);
    expect(book.find(1, 2)).toBeNull();
  });
});
