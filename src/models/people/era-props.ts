import { MaterialSlot } from "../materials.ts";
import type { MeshBuilder } from "../mesh/mesh-builder.ts";
import { box, cylinder, lathe, sphere, torus } from "../mesh/shapes.ts";
import { transformOf } from "../mesh/transforms.ts";
import { rigidStyle } from "../rig/skin-weights.ts";
import { type HumanDetail, trimSegments } from "./human-detail.ts";
import { FLEXIBLE_TORSO_STYLE } from "./human-rigging.ts";
import { HumanBone } from "./human-skeleton.ts";

const TORC_HEIGHT = 1.444;
const TORC_RADIUS = 0.068;
const TORC_THICKNESS = 0.011;
const BROOCH_HEIGHT = 1.415;
const BUCKLE_HEIGHT = 1.018;

export function addTorc(builder: MeshBuilder, detail: HumanDetail): void {
  const style = { ...FLEXIBLE_TORSO_STYLE, slot: MaterialSlot.Metal };

  builder.add(torus(TORC_RADIUS, TORC_THICKNESS, trimSegments(detail, 22), 5), {
    style,
    transform: transformOf({ position: [0, TORC_HEIGHT, -0.004], rotation: [-0.22, 0, 0], scale: [1, 1, 0.94] }),
  });

  if (!detail.hasFineDetails) {
    return;
  }

  for (const side of [-1, 1]) {
    builder.add(sphere(0.017, 6, 4), {
      style,
      transform: transformOf({ position: [side * 0.022, TORC_HEIGHT + 0.012, 0.057] }),
    });
  }
}

export function addHelmet(builder: MeshBuilder, detail: HumanDetail): void {
  const style = { ...rigidStyle(HumanBone.Head), slot: MaterialSlot.Metal };

  builder.add(
    lathe(
      [
        { radius: 0, y: 1.64 },
        { radius: 0.104, y: 1.643 },
        { radius: 0.113, y: 1.662 },
        { radius: 0.106, y: 1.705 },
        { radius: 0.078, y: 1.77 },
        { radius: 0.034, y: 1.82 },
        { radius: 0.008, y: 1.842 },
        { radius: 0, y: 1.845 },
      ],
      trimSegments(detail, 14)
    ),
    { style, transform: transformOf({ position: [0, 0, -0.006], scale: [1, 1, 1.1] }) }
  );

  if (!detail.hasFineDetails) {
    return;
  }

  builder.add(box(0.018, 0.075, 0.012), {
    style,
    transform: transformOf({ position: [0, 1.625, 0.112], rotation: [-0.18, 0, 0] }),
  });
}

export function addBrooch(builder: MeshBuilder, detail: HumanDetail): void {
  const style = { ...FLEXIBLE_TORSO_STYLE, slot: MaterialSlot.Metal };

  builder.add(cylinder({ height: 0.05, radialSegments: 5, radiusBottom: 0.006, radiusTop: 0.006 }), {
    style,
    transform: transformOf({ position: [0, BROOCH_HEIGHT, 0.06], rotation: [Math.PI / 2, 0, 0] }),
  });
  builder.add(sphere(1, trimSegments(detail, 10), 4), {
    style,
    transform: transformOf({ position: [0, BROOCH_HEIGHT, 0.112], scale: [0.026, 0.026, 0.009] }),
  });
}

export function addBuckle(builder: MeshBuilder, detail: HumanDetail): void {
  const style = { ...FLEXIBLE_TORSO_STYLE, slot: MaterialSlot.Metal };

  builder.add(box(0.05, 0.04, 0.06), {
    style,
    transform: transformOf({ position: [0, BUCKLE_HEIGHT, 0.115] }),
  });

  if (!detail.hasFineDetails) {
    return;
  }

  builder.add(box(0.012, 0.03, 0.012), {
    style: { ...style, slot: MaterialSlot.Hide },
    transform: transformOf({ position: [0, BUCKLE_HEIGHT, 0.148] }),
  });
}
