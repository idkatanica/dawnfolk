import { Color, type Group, Sphere, Vector3 } from "three/webgpu";
import { MaterialSlot } from "../../models/materials.ts";
import { type PersonAppearance, personAppearance, type TribeLook } from "../../models/people/appearance.ts";
import { applyHumanClip, type HumanClipContext } from "../../models/people/human-clips.ts";
import { HUMAN_DETAILS } from "../../models/people/human-detail.ts";
import { activityParts, appearanceParts, buildHumanParts, humanPartIndex } from "../../models/people/human-model.ts";
import { humanBoneScales } from "../../models/people/human-proportions.ts";
import { HUMAN_BONE_COUNT, HUMAN_SKELETON } from "../../models/people/human-skeleton.ts";
import { Pose } from "../../models/rig/pose.ts";
import { SkeletonPoser } from "../../models/rig/skeleton-poser.ts";
import { parseHexColor } from "../../shared/color.ts";
import { smoothstep } from "../../shared/math.ts";
import type { TribeSummary } from "../../simulation/frame.ts";
import type { Inspection } from "../../simulation/inspection.ts";
import { PERSON_STRIDE, PersonField } from "../../world/agent-buffers.ts";
import { CARRIED_ITEMS, type CarriedItem, PERSON_POSES } from "../../world/agent-poses.ts";
import { AgentMotion } from "./agent-motion.ts";
import { AgentPalette } from "./agent-palette.ts";
import {
  type AgentViewInput,
  detailLevel,
  farthestFigure,
  HIDDEN_LEVEL,
  type LevelDistances,
  NO_SELECTION,
  standingHeight,
} from "./agent-view-input.ts";
import { HumanStrides } from "./human-strides.ts";
import { type MarkerStyle, personMarker } from "./marker-look.ts";
import { colorTexel, type PaletteLayout, paletteWidth, rootTexel } from "./palette-layout.ts";
import { PartBatches } from "./part-batches.ts";
import { createSkinnedMaterial } from "./skinned-material.ts";

const PERSON_LAYOUT: PaletteLayout = {
  boneCount: HUMAN_BONE_COUNT,
  colorSlots: [MaterialSlot.Skin, MaterialSlot.Hair, MaterialSlot.Fur, MaterialSlot.Hide, MaterialSlot.Accent],
};

const LEVEL_DISTANCES: LevelDistances = { high: 70, low: 420 };
const BOUNDING_RADIUS = 1.4;
const WADING_DEPTH = 1.1;
const DEFAULT_TRIBE: TribeLook = { accent: 0xc4_55_3a, fur: 0x6b_4a_33, id: -1 };
const MARKER_LIFT = 1;

interface PersonVisual {
  readonly appearance: PersonAppearance;
  readonly appearanceKey: string;
  readonly baseParts: readonly number[];
  readonly colors: readonly Color[];
  readonly motion: AgentMotion;
  readonly scales: Float32Array;
}

function activityTable(): readonly (readonly (readonly number[])[])[] {
  return PERSON_POSES.map((pose) =>
    CARRIED_ITEMS.map((carried) => activityParts(pose, carried).map((part) => humanPartIndex(part)))
  );
}

function tribeLookOf(tribe: TribeSummary): TribeLook {
  return { accent: parseHexColor(tribe.color), fur: parseHexColor(tribe.furColor), id: tribe.id };
}

function colorsOf(appearance: PersonAppearance): Color[] {
  const { colors } = appearance;

  return [colors.skin, colors.hair, colors.fur, colors.hide, colors.accent].map((hex) => new Color(hex));
}

function selectedPersonId(inspection: Inspection | null): number {
  if (inspection?.kind !== "person") {
    return NO_SELECTION;
  }

  return inspection.id;
}

export class PeopleView {
  readonly #activityParts = activityTable();
  readonly #batches: PartBatches;
  readonly #blendedPose = new Pose(HUMAN_BONE_COUNT);
  readonly #bounds = new Sphere(new Vector3(), BOUNDING_RADIUS);
  readonly #markerAnchor = new Vector3();
  readonly #markerStyles = new Map<number, MarkerStyle>();
  readonly #palette = new AgentPalette(paletteWidth(PERSON_LAYOUT));
  readonly #pose = new Pose(HUMAN_BONE_COUNT);
  readonly #poser = new SkeletonPoser(HUMAN_SKELETON);
  readonly #previousPose = new Pose(HUMAN_BONE_COUNT);
  readonly #seen = new Set<number>();
  readonly #strides = new HumanStrides();
  readonly #tribes = new Map<number, TribeLook>();
  readonly #visuals = new Map<number, PersonVisual>();
  #figureCount = 0;
  #selectedId = NO_SELECTION;
  #uploadedRows = 0;

  constructor() {
    const material = createSkinnedMaterial(this.#palette, PERSON_LAYOUT);

    this.#batches = new PartBatches(
      [
        { castsShadow: true, parts: buildHumanParts(HUMAN_DETAILS.high) },
        { castsShadow: false, parts: buildHumanParts(HUMAN_DETAILS.low) },
      ],
      material
    );
  }

  get figureCount(): number {
    return this.#figureCount;
  }

  get group(): Group {
    return this.#batches.group;
  }

  update(input: AgentViewInput): void {
    const { frame } = input.mirror;

    this.#seen.clear();
    this.#selectedId = selectedPersonId(frame.inspection);
    this.#rememberTribes(frame.tribes);
    this.#batches.begin();

    let rows = 0;

    for (let person = 0; person < frame.personCount; person += 1) {
      const offset = person * PERSON_STRIDE;

      this.#seen.add(frame.people[offset + PersonField.Id]);

      if (this.#drawPerson(input, offset, rows)) {
        rows += 1;
      }
    }

    this.#figureCount = rows;
    this.#forgetMissing();
    this.#batches.commit();

    if (rows > 0 || this.#uploadedRows > 0) {
      this.#palette.upload();
    }

    this.#uploadedRows = rows;
  }

  dispose(): void {
    this.#batches.dispose();
    this.#palette.dispose();
  }

  #drawPerson(input: AgentViewInput, offset: number, row: number): boolean {
    const { people } = input.mirror.frame;

    const x = people[offset + PersonField.X] + people[offset + PersonField.VelocityX] * input.secondsSinceTick;
    const z = people[offset + PersonField.Z] + people[offset + PersonField.VelocityZ] * input.secondsSinceTick;

    const y = standingHeight(input.mirror, x, z, WADING_DEPTH);

    this.#bounds.center.set(x, y + 0.9, z);

    const distance = input.camera.position.distanceTo(this.#bounds.center);

    const level = detailLevel(distance, LEVEL_DISTANCES, input.detail);

    this.#mark(input, offset, this.#markerAnchor.set(x, y + MARKER_LIFT, z));

    if (level === HIDDEN_LEVEL || !input.frustum.intersectsSphere(this.#bounds)) {
      return false;
    }

    const visual = this.#visualFor(people, offset);
    const clipCode = people[offset + PersonField.Pose];
    const carriedCode = people[offset + PersonField.Carried];

    this.#animate(input, visual, people, offset);
    this.#palette.ensureRows(row + 1);
    this.#writePose(visual, CARRIED_ITEMS[carriedCode], row);
    this.#writeRoot(row, x, y, z, visual.motion.heading);
    this.#writeColors(row, visual.colors);

    for (const part of visual.baseParts) {
      this.#batches.add(level, part, row);
    }

    for (const part of this.#activityParts[clipCode][carriedCode]) {
      this.#batches.add(level, part, row);
    }

    return true;
  }

  #mark(input: AgentViewInput, offset: number, anchor: Vector3): void {
    const { people } = input.mirror.frame;

    if (PERSON_POSES[people[offset + PersonField.Pose]] === "dead") {
      return;
    }

    const style = this.#markerStyle(people[offset + PersonField.TribeId]);
    const isSelected = people[offset + PersonField.Id] === this.#selectedId;

    input.markers.add(anchor, style, farthestFigure(LEVEL_DISTANCES, input.detail), isSelected);
  }

  #animate(input: AgentViewInput, visual: PersonVisual, people: Float32Array, offset: number): void {
    const clipCode = people[offset + PersonField.Pose];
    const speed = Math.hypot(people[offset + PersonField.VelocityX], people[offset + PersonField.VelocityZ]);

    visual.motion.advance({
      clip: clipCode,
      gameSeconds: input.gameSeconds,
      heading: people[offset + PersonField.Heading],
      rate: this.#strides.cyclesPerSecond(PERSON_POSES[clipCode], speed, visual.appearance),
      realSeconds: input.realSeconds,
    });
  }

  #writePose(visual: PersonVisual, carried: CarriedItem, row: number): void {
    const { appearance, motion } = visual;

    const context = { ageGroup: appearance.ageGroup, carried, motion: appearance.motion };

    applyHumanClip(this.#pose, PERSON_POSES[motion.clip], motion.phase, context);

    const pose = this.#blendIfNeeded(motion, context);

    this.#poser.pose(pose, visual.scales);
    this.#poser.writePalette(this.#palette.data, this.#palette.rowOffset(row));
  }

  #blendIfNeeded(motion: AgentMotion, context: HumanClipContext): Pose {
    if (motion.blend >= 1) {
      return this.#pose;
    }

    const eased = smoothstep(0, 1, motion.blend);

    applyHumanClip(this.#previousPose, PERSON_POSES[motion.previousClip], motion.previousPhase, context);
    this.#blendedPose.blendBetween(this.#previousPose, this.#pose, eased);

    return this.#blendedPose;
  }

  #writeRoot(row: number, x: number, y: number, z: number, heading: number): void {
    const { data } = this.#palette;

    const offset = this.#palette.texelOffset(row, rootTexel(PERSON_LAYOUT));

    data[offset] = x;
    data[offset + 1] = y;
    data[offset + 2] = z;
    data[offset + 3] = heading;
  }

  #writeColors(row: number, colors: readonly Color[]): void {
    const { data } = this.#palette;

    for (const [index, color] of colors.entries()) {
      const offset = this.#palette.texelOffset(row, colorTexel(PERSON_LAYOUT, index));

      data[offset] = color.r;
      data[offset + 1] = color.g;
      data[offset + 2] = color.b;
    }
  }

  #visualFor(people: Float32Array, offset: number): PersonVisual {
    const id = people[offset + PersonField.Id];
    const age = people[offset + PersonField.Age];
    const tribeId = people[offset + PersonField.TribeId];
    const key = `${Math.floor(age)}:${tribeId}`;

    const existing = this.#visuals.get(id);

    if (existing !== undefined && existing.appearanceKey === key) {
      return existing;
    }

    const appearance = personAppearance({
      age,
      isFemale: people[offset + PersonField.IsFemale] > 0.5,
      seed: people[offset + PersonField.AppearanceSeed],
      tribe: this.#tribeLook(tribeId),
    });

    const visual: PersonVisual = {
      appearance,
      appearanceKey: key,
      baseParts: appearanceParts(appearance).map((part) => humanPartIndex(part)),
      colors: colorsOf(appearance),
      motion: this.#motionFor(existing, people, offset),
      scales: humanBoneScales(appearance.body),
    };

    this.#visuals.set(id, visual);

    return visual;
  }

  #motionFor(existing: PersonVisual | undefined, people: Float32Array, offset: number): AgentMotion {
    if (existing !== undefined) {
      return existing.motion;
    }

    return new AgentMotion(
      people[offset + PersonField.Pose],
      people[offset + PersonField.Phase],
      people[offset + PersonField.Heading]
    );
  }

  #markerStyle(tribeId: number): MarkerStyle {
    const { accent } = this.#tribeLook(tribeId);

    const known = this.#markerStyles.get(accent);

    if (known !== undefined) {
      return known;
    }

    const style = personMarker(accent);

    this.#markerStyles.set(accent, style);

    return style;
  }

  #tribeLook(tribeId: number): TribeLook {
    const look = this.#tribes.get(tribeId);

    if (look === undefined) {
      return DEFAULT_TRIBE;
    }

    return look;
  }

  #rememberTribes(tribes: readonly TribeSummary[]): void {
    for (const tribe of tribes) {
      if (!this.#tribes.has(tribe.id)) {
        this.#tribes.set(tribe.id, tribeLookOf(tribe));
      }
    }
  }

  #forgetMissing(): void {
    for (const id of this.#visuals.keys()) {
      if (!this.#seen.has(id)) {
        this.#visuals.delete(id);
      }
    }
  }
}
