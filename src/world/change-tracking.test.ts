import { describe, expect, it } from "vitest";
import { RegionChangeTracker, RowChangeTracker } from "./change-tracking.ts";

describe("row change tracker", () => {
  it("reports nothing until a row changes", () => {
    const tracker = new RowChangeTracker(16);

    expect(tracker.hasChanges).toBe(false);
    expect(tracker.takeRuns()).toEqual([]);
  });

  it("merges neighbouring rows into runs", () => {
    const tracker = new RowChangeTracker(16);

    tracker.markRow(2);
    tracker.markRow(3);
    tracker.markRows(7, 9);
    tracker.markRow(15);

    expect(tracker.takeRuns()).toEqual([
      { firstRow: 2, rowCount: 2 },
      { firstRow: 7, rowCount: 3 },
      { firstRow: 15, rowCount: 1 },
    ]);
  });

  it("clears the marks after taking them", () => {
    const tracker = new RowChangeTracker(8);

    tracker.markAll();
    tracker.takeRuns();

    expect(tracker.hasChanges).toBe(false);
    expect(tracker.takeRuns()).toEqual([]);
  });

  it("clamps row ranges to the grid", () => {
    const tracker = new RowChangeTracker(4);

    tracker.markRows(-3, 10);

    expect(tracker.takeRuns()).toEqual([{ firstRow: 0, rowCount: 4 }]);
  });
});

describe("region change tracker", () => {
  it("grows the region to cover every edit", () => {
    const tracker = new RegionChangeTracker();

    tracker.markRegion({ firstColumn: 4, firstRow: 4, lastColumn: 6, lastRow: 5 });
    tracker.markRegion({ firstColumn: 1, firstRow: 5, lastColumn: 3, lastRow: 9 });

    expect(tracker.takeRegion()).toEqual({ firstColumn: 1, firstRow: 4, lastColumn: 6, lastRow: 9 });
    expect(tracker.hasChanges).toBe(false);
    expect(tracker.takeRegion()).toBeNull();
  });
});
