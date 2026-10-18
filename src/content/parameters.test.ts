import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  choiceParameter,
  describeParameterGroups,
  describeParameters,
  groupMetadata,
  rangeParameter,
  toggleParameter,
} from "./parameters.ts";

const radius = rangeParameter({
  defaultValue: 25,
  description: "Brush size",
  label: "Radius",
  maximum: 150,
  minimum: 5,
  step: 1,
  unit: "meters",
});

const spreadsEmbers = toggleParameter({ defaultValue: true, description: "Throws embers", label: "Embers" });

const material = choiceParameter({
  defaultValue: "sand",
  description: "Ground to paint",
  label: "Material",
  options: [
    { label: "Sand", value: "sand" },
    { label: "Rock", value: "rock" },
  ],
});

describe("parameter schemas", () => {
  it("fill every field with its default value", () => {
    const schema = z.object({ material, radius, spreadsEmbers });

    expect(schema.parse({})).toEqual({ material: "sand", radius: 25, spreadsEmbers: true });
  });

  it("reject values outside the range", () => {
    expect(radius.safeParse(500).success).toBe(false);
    expect(radius.safeParse(4).success).toBe(false);
    expect(radius.safeParse(60).success).toBe(true);
  });

  it("reject unknown choices", () => {
    expect(material.safeParse("lava").success).toBe(false);
  });

  it("describe fields for the interface in schema order", () => {
    const fields = describeParameters(z.object({ material, radius, spreadsEmbers }));

    expect(fields.map((field) => field.key)).toEqual(["material", "radius", "spreadsEmbers"]);
    expect(fields[0]?.metadata).toMatchObject({ kind: "choice", options: [{ value: "sand" }, { value: "rock" }] });
    expect(fields[1]?.metadata).toMatchObject({ kind: "range", label: "Radius", maximum: 150, minimum: 5 });
    expect(fields[2]?.metadata).toMatchObject({ kind: "toggle", label: "Embers" });
  });

  it("describe nested groups and give groups their defaults", () => {
    const schema = z.object({
      brush: z.object({ radius }).prefault({}).meta(groupMetadata("Brush", "Brush settings")),
    });

    const [group] = describeParameterGroups(schema);

    expect(group?.metadata.label).toBe("Brush");
    expect(group?.fields.map((field) => field.key)).toEqual(["radius"]);
    expect(schema.parse({})).toEqual({ brush: { radius: 25 } });
  });
});
