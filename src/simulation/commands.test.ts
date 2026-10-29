import { describe, expect, it, vi } from "vitest";
import { readCommand } from "./commands.ts";

describe("reading commands", () => {
  it("accepts grabbing, carrying, dropping and cancelling", () => {
    const commands = [
      { target: { id: 4, kind: "person" }, type: "grab" },
      { target: { id: 0, kind: "plant" }, type: "grab" },
      { type: "carry", x: 12.5, z: -3 },
      { type: "drop" },
      { type: "cancelGrab" },
    ];

    for (const command of commands) {
      expect(readCommand(command)).toEqual(command);
    }
  });

  it("rejects a grab of an unknown kind or a broken id", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(readCommand({ target: { id: 4, kind: "building" }, type: "grab" })).toBeNull();
    expect(readCommand({ target: { id: 1.5, kind: "animal" }, type: "grab" })).toBeNull();
    expect(readCommand({ target: { id: -1, kind: "plant" }, type: "grab" })).toBeNull();
    expect(readCommand({ type: "carry", x: "near" })).toBeNull();
  });
});
