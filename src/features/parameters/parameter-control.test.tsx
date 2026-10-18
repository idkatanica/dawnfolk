import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import type { ParameterField } from "../../content/parameters.ts";
import { ParameterControl } from "./parameter-control.tsx";

const RADIUS_FIELD: ParameterField = {
  key: "radius",
  metadata: {
    defaultValue: 25,
    description: "How far the power reaches.",
    kind: "range",
    label: "Radius",
    maximum: 60,
    minimum: 5,
    step: 5,
    unit: "meters",
  },
};

const SPREAD_FIELD: ParameterField = {
  key: "spreadSpeed",
  metadata: {
    defaultValue: 1,
    description: "How quickly flames heat their neighbours.",
    kind: "range",
    label: "Spread speed",
    maximum: 3,
    minimum: 0.2,
    step: 0.1,
    unit: "multiplier",
  },
};

const EMBERS_FIELD: ParameterField = {
  key: "embers",
  metadata: { defaultValue: false, description: "Throw embers ahead of the fire.", kind: "toggle", label: "Embers" },
};

const SHAPE_FIELD: ParameterField = {
  key: "shape",
  metadata: {
    defaultValue: "ring",
    description: "The outline the power draws.",
    kind: "choice",
    label: "Shape",
    options: [
      { label: "Ring", value: "ring" },
      { label: "Line", value: "line" },
    ],
  },
};

describe("range parameter", () => {
  it("shows a slider with the value in the parameter's unit", async () => {
    const screen = await render(<ParameterControl field={RADIUS_FIELD} onChange={vi.fn()} value={35} />);

    await expect.element(screen.getByRole("slider", { name: "Radius" })).toHaveValue("35");
    await expect.element(screen.getByText("35 m")).toBeVisible();
  });

  it("shows as many decimals as its step needs", async () => {
    const screen = await render(<ParameterControl field={SPREAD_FIELD} onChange={vi.fn()} value={1} />);

    await expect.element(screen.getByText("×1.0")).toBeVisible();
  });

  it("falls back to the default when the stored value is not a number", async () => {
    const screen = await render(<ParameterControl field={RADIUS_FIELD} onChange={vi.fn()} value="far" />);

    await expect.element(screen.getByText("25 m")).toBeVisible();
  });

  it("reports a new value under the parameter's key", async () => {
    const handleChange = vi.fn();

    const screen = await render(<ParameterControl field={RADIUS_FIELD} onChange={handleChange} value={25} />);

    screen.getByRole("slider", { name: "Radius" }).element().focus();

    await userEvent.keyboard("{ArrowRight}");

    expect(handleChange).toHaveBeenCalledExactlyOnceWith("radius", 30);
  });
});

describe("toggle parameter", () => {
  it("shows a switch in its stored state", async () => {
    const screen = await render(<ParameterControl field={EMBERS_FIELD} onChange={vi.fn()} value={true} />);

    await expect.element(screen.getByRole("switch", { name: "Embers" })).toBeChecked();
  });

  it("falls back to the default when nothing is stored", async () => {
    const screen = await render(<ParameterControl field={EMBERS_FIELD} onChange={vi.fn()} value={undefined} />);

    await expect.element(screen.getByRole("switch", { name: "Embers" })).not.toBeChecked();
  });

  it("reports the new state under the parameter's key", async () => {
    const handleChange = vi.fn();

    const screen = await render(<ParameterControl field={EMBERS_FIELD} onChange={handleChange} value={false} />);

    await screen.getByRole("switch", { name: "Embers" }).click();

    expect(handleChange).toHaveBeenCalledExactlyOnceWith("embers", true);
  });
});

describe("choice parameter", () => {
  it("shows the options with the stored one picked", async () => {
    const screen = await render(<ParameterControl field={SHAPE_FIELD} onChange={vi.fn()} value="line" />);

    await expect.element(screen.getByRole("button", { name: "Line", pressed: true })).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Ring", pressed: false })).toBeVisible();
  });

  it("falls back to the default when the stored value is not text", async () => {
    const screen = await render(<ParameterControl field={SHAPE_FIELD} onChange={vi.fn()} value={3} />);

    await expect.element(screen.getByRole("button", { name: "Ring", pressed: true })).toBeVisible();
  });

  it("reports the chosen option under the parameter's key", async () => {
    const handleChange = vi.fn();

    const screen = await render(<ParameterControl field={SHAPE_FIELD} onChange={handleChange} value="ring" />);

    await screen.getByRole("button", { name: "Line" }).click();

    expect(handleChange).toHaveBeenCalledExactlyOnceWith("shape", "line");
  });
});
