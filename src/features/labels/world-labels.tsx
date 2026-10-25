import { useRef } from "react";
import { useEngine } from "../../app/use-engine.ts";
import { cn } from "../../design/cn.ts";
import { GameIcon } from "../../design/game-icon.tsx";
import type { EngineHandle } from "../../game/engine-handle.ts";
import type { Landmark } from "../../game/landmarks.ts";
import type { TribeSummary } from "../../simulation/frame.ts";
import type { RivalryView } from "../../simulation/society/rivalry/rivalry-system.ts";
import { useShowTribe } from "../inspector/use-focus-camera.ts";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { isFeuding, raidOf } from "../rivalry/stance-looks.ts";
import { TribeDot } from "../tribes/tribe-dot.tsx";
import { useWorldStore, type WorldSnapshot } from "../world/world-store.ts";
import { useLabelLayout } from "./use-label-layout.ts";

const TRIBE_LIFT = 18;
const LABEL_FRAME =
  "invisible absolute top-0 left-0 opacity-0 transition-[opacity,visibility] duration-200 will-change-transform data-shown:visible data-shown:opacity-100";

function selectedTribeIdOf(state: { readonly snapshot: WorldSnapshot | null }): number | null {
  const inspection = state.snapshot?.inspection;

  if (inspection?.kind !== "tribe") {
    return null;
  }

  return inspection.summary.id;
}

function LandmarkDetail({ detail }: { readonly detail: string | null }) {
  if (detail === null) {
    return null;
  }

  return <span className="font-medium text-xs tabular-nums opacity-90">{detail}</span>;
}

function LandmarkLabel({ landmark }: { readonly landmark: Landmark }) {
  return (
    <li
      className={cn(LABEL_FRAME, "flex flex-col items-center text-shadow-black/55 text-shadow-md text-white")}
      data-label=""
      data-lift={landmark.lift}
      data-x={landmark.x}
      data-z={landmark.z}
    >
      <span className={cn("font-semibold text-sm tracking-wide", { italic: landmark.kind === "lake" })}>
        {landmark.name}
      </span>

      <LandmarkDetail detail={landmark.detail} />
    </li>
  );
}

type TribeMood = "calm" | "feuding" | "raiding";

interface TribeLabelProps {
  readonly isSelected: boolean;
  readonly mood: TribeMood;
  readonly tribe: TribeSummary;
}

function moodOf(rivalry: RivalryView | undefined, tribeId: number): TribeMood {
  if (rivalry === undefined) {
    return "calm";
  }

  if (raidOf(rivalry, tribeId) !== null) {
    return "raiding";
  }

  return isFeuding(rivalry, tribeId) ? "feuding" : "calm";
}

function FeudMark({ mood }: { readonly mood: TribeMood }) {
  if (mood === "calm") {
    return null;
  }

  return (
    <span className="flex" title={mood === "raiding" ? "Raid under way" : "In a feud"}>
      <GameIcon label={mood === "raiding" ? "Raid under way" : "In a feud"} name="raid" size={18} />
    </span>
  );
}

function TribeLabel({ isSelected, mood, tribe }: TribeLabelProps) {
  const showTribe = useShowTribe(tribe);

  return (
    <li
      className={cn(LABEL_FRAME, "flex flex-col items-center")}
      data-label=""
      data-lift={TRIBE_LIFT}
      data-priority=""
      data-x={tribe.campX}
      data-z={tribe.campZ}
    >
      <button
        aria-current={isSelected}
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full bg-veil py-1 pr-3 pl-1.5 text-xs outline-none ring-1 ring-white/40 backdrop-blur-xl backdrop-saturate-150 transition-colors hover:bg-white/75 focus-visible:ring-2 focus-visible:ring-dawn",
          { "ring-2 ring-dawn": isSelected, "ring-2 ring-ember/80": mood === "raiding" && !isSelected }
        )}
        onClick={showTribe}
        type="button"
      >
        <TribeDot color={tribe.color} />

        <span className="font-semibold text-ink">{tribe.name}</span>

        <span className="font-semibold text-dawn-strong tabular-nums">{tribe.population}</span>

        <FeudMark mood={mood} />

        <span className="text-ink-muted group-data-far:hidden">{tribe.eraName}</span>
      </button>

      <span aria-hidden="true" className="h-2 w-px bg-white/90" />
    </li>
  );
}

function TribeLabels() {
  const tribes = useWorldStore((state) => state.snapshot?.tribes);
  const rivalry = useWorldStore((state) => state.snapshot?.rivalry);
  const selectedTribeId = useWorldStore(selectedTribeIdOf);

  if (tribes === undefined || tribes.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Tribes">
      {tribes.map((tribe) => (
        <TribeLabel
          isSelected={tribe.id === selectedTribeId}
          key={tribe.id}
          mood={moodOf(rivalry, tribe.id)}
          tribe={tribe}
        />
      ))}
    </ul>
  );
}

function LabelLayer({ engine }: { readonly engine: EngineHandle }) {
  const layerReference = useRef<HTMLDivElement>(null);

  useLabelLayout(layerReference, engine);

  return (
    <div className="group pointer-events-none fixed inset-0 overflow-hidden" ref={layerReference}>
      <ul aria-label="Places">
        {engine.landmarks.map((landmark) => (
          <LandmarkLabel key={landmark.id} landmark={landmark} />
        ))}
      </ul>

      <TribeLabels />
    </div>
  );
}

export function WorldLabels() {
  const engine = useEngine();
  const areLabelsShown = useInterfaceStore((state) => state.areLabelsShown);

  if (engine === null || !areLabelsShown) {
    return null;
  }

  return <LabelLayer engine={engine} />;
}
