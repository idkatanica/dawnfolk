import { type RefObject, useEffect } from "react";
import type { EngineHandle } from "../../game/engine-handle.ts";
import type { LabelPlacement } from "../../game/label-projector.ts";

interface LabelAnchor {
  readonly lift: number;
  readonly x: number;
  readonly z: number;
}

interface PlacedLabel {
  readonly isPriority: boolean;
  readonly label: HTMLElement;
  readonly placement: LabelPlacement;
}

const LABEL_SELECTOR = "[data-label]";
const TOP_CLEARANCE = 76;
const FAR_DISTANCE = 2600;
const CROWDED_WIDTH = 150;
const CROWDED_HEIGHT = 40;

function readCoordinate(label: HTMLElement, attribute: string): number | null {
  const text = label.getAttribute(attribute);

  if (text === null) {
    return null;
  }

  const value = Number(text);

  return Number.isFinite(value) ? value : null;
}

function anchorOf(label: HTMLElement): LabelAnchor | null {
  const x = readCoordinate(label, "data-x");
  const z = readCoordinate(label, "data-z");
  const lift = readCoordinate(label, "data-lift");

  if (x === null || z === null || lift === null) {
    return null;
  }

  return { lift, x, z };
}

function placementOf(engine: EngineHandle, label: HTMLElement): LabelPlacement | null {
  const anchor = anchorOf(label);

  if (anchor === null) {
    return null;
  }

  return engine.placeLabel(anchor.x, anchor.z, anchor.lift);
}

function isCrowding(first: LabelPlacement, second: LabelPlacement): boolean {
  return Math.abs(first.left - second.left) < CROWDED_WIDTH && Math.abs(first.top - second.top) < CROWDED_HEIGHT;
}

function showLabel(label: HTMLElement, placement: LabelPlacement): void {
  label.style.transform = `translate3d(${placement.left.toFixed(1)}px, ${placement.top.toFixed(1)}px, 0) translate(-50%, -100%)`;
  label.toggleAttribute("data-shown", true);
}

function hideLabel(label: HTMLElement): void {
  label.toggleAttribute("data-shown", false);
}

function placeVisibleLabels(engine: EngineHandle, layer: HTMLElement): PlacedLabel[] {
  const placed: PlacedLabel[] = [];

  for (const label of layer.querySelectorAll<HTMLElement>(LABEL_SELECTOR)) {
    const placement = placementOf(engine, label);

    if (placement === null || placement.top < TOP_CLEARANCE) {
      hideLabel(label);
      continue;
    }

    placed.push({ isPriority: label.hasAttribute("data-priority"), label, placement });
  }

  return placed;
}

function placeLabels(engine: EngineHandle, layer: HTMLElement): void {
  layer.toggleAttribute("data-far", engine.camera.state.distance > FAR_DISTANCE);

  const placed = placeVisibleLabels(engine, layer);

  const priority = placed.filter((entry) => entry.isPriority);

  for (const entry of placed) {
    const isCrowded = !entry.isPriority && priority.some((other) => isCrowding(other.placement, entry.placement));

    if (isCrowded) {
      hideLabel(entry.label);
      continue;
    }

    showLabel(entry.label, entry.placement);
  }
}

export function useLabelLayout(layerReference: RefObject<HTMLElement | null>, engine: EngineHandle): void {
  useEffect(() => {
    const layer = layerReference.current;

    if (layer === null) {
      return;
    }

    const place = () => placeLabels(engine, layer);

    place();

    return engine.subscribeToRenders(place);
  }, [engine, layerReference]);
}
