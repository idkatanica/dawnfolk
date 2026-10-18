import { type FormEvent, useState } from "react";
import { type LaunchChanges, useLaunchStore } from "../../app/launch-store.ts";
import { storeQuality } from "../../app/preferences.ts";
import { useEngine } from "../../app/use-engine.ts";
import { TextButton } from "../../design/buttons.tsx";
import { ChoiceField } from "../../design/choice-field.tsx";
import { ToggleField } from "../../design/toggle-field.tsx";
import type { EngineHandle } from "../../game/engine-handle.ts";
import { isQualityLevel, QUALITY_LEVELS, type QualityLevel } from "../../rendering/render-quality.ts";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { useWorldDraft } from "../new-world/use-world-draft.ts";
import { NameField, SeedField, ShapeChoice } from "../new-world/world-fields.tsx";
import { useWorldStore } from "../world/world-store.ts";

const QUALITY_LABELS: Readonly<Record<QualityLevel, string>> = { high: "High", low: "Light", medium: "Balanced" };

const QUALITY_OPTIONS = QUALITY_LEVELS.map((level) => ({ label: QUALITY_LABELS[level], value: level }));

function activeQuality(engine: EngineHandle | null): QualityLevel {
  if (engine === null) {
    return "medium";
  }

  return engine.quality;
}

function useRelaunch() {
  const relaunch = useLaunchStore((state) => state.relaunch);
  const setSettingsOpen = useInterfaceStore((state) => state.setSettingsOpen);

  return (changes: LaunchChanges) => {
    setSettingsOpen(false);
    relaunch(changes);
  };
}

function useQualityChoice() {
  const engine = useEngine();
  const relaunch = useRelaunch();

  const active = activeQuality(engine);

  const [quality, setQuality] = useState<QualityLevel>(active);

  function changeQuality(value: string): void {
    if (!isQualityLevel(value)) {
      return;
    }

    setQuality(value);
    storeQuality(value);
  }

  function applyQuality(): void {
    relaunch({ quality });
  }

  return { applyQuality, changeQuality, hasChanged: quality !== active, quality };
}

function useNewWorld() {
  const launch = useLaunchStore((state) => state.launch);
  const currentSeed = useWorldStore((state) => state.seed);
  const relaunch = useRelaunch();

  const draft = useWorldDraft({ name: launch.name, seed: currentSeed, shape: launch.shape });

  function createWorld(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (draft.choice !== null) {
      relaunch(draft.choice);
    }
  }

  return { createWorld, draft };
}

function QualityChoice() {
  const { applyQuality, changeQuality, hasChanged, quality } = useQualityChoice();

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-veil p-4">
      <ChoiceField
        description="Light suits phones and older laptops; High adds sharper shadows and more detail far away."
        label="Graphics"
        onChange={changeQuality}
        options={QUALITY_OPTIONS}
        value={quality}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-ink-muted text-xs">The island is rebuilt from its seed to switch the quality.</p>

        <TextButton disabled={!hasChanged} onClick={applyQuality} tone="accent">
          Apply
        </TextButton>
      </div>
    </div>
  );
}

function MapLabelsChoice() {
  const areLabelsShown = useInterfaceStore((state) => state.areLabelsShown);
  const setLabelsShown = useInterfaceStore((state) => state.setLabelsShown);

  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-veil p-4">
      <ToggleField isChecked={areLabelsShown} label="Map labels" onChange={setLabelsShown} />

      <p className="text-ink-muted text-xs">Tribe banners and the names of peaks and lakes over the island.</p>
    </div>
  );
}

function NewWorld() {
  const { createWorld, draft } = useNewWorld();

  return (
    <form aria-label="New world" className="flex flex-col gap-3 rounded-2xl bg-veil p-4" onSubmit={createWorld}>
      <div className="flex flex-col gap-0.5">
        <h3 className="font-semibold text-ink text-sm">New world</h3>

        <p className="text-ink-muted text-xs">Every seed grows a different island. The current one is lost.</p>
      </div>

      <NameField onChange={draft.changeName} onRoll={draft.rollName} value={draft.nameText} />

      <ShapeChoice onChange={draft.changeShape} value={draft.shape} />

      <div className="flex items-center gap-2">
        <SeedField
          className="min-w-0 flex-1"
          onChange={draft.changeSeed}
          onRoll={draft.rollSeed}
          value={draft.seedText}
        />

        <TextButton disabled={draft.choice === null} tone="accent" type="submit">
          Create
        </TextButton>
      </div>
    </form>
  );
}

export function GraphicsSection() {
  return (
    <div className="flex flex-col gap-3">
      <QualityChoice />

      <MapLabelsChoice />

      <NewWorld />
    </div>
  );
}
