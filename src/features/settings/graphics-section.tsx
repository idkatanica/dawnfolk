import { Dices } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { LARGEST_SEED, randomSeed } from "../../app/launch-options.ts";
import { type LaunchChanges, useLaunchStore } from "../../app/launch-store.ts";
import { storeQuality } from "../../app/preferences.ts";
import { useEngine } from "../../app/use-engine.ts";
import { IconButton, TextButton } from "../../design/buttons.tsx";
import { ChoiceField } from "../../design/choice-field.tsx";
import { ToggleField } from "../../design/toggle-field.tsx";
import type { EngineHandle } from "../../game/engine-handle.ts";
import { isQualityLevel, QUALITY_LEVELS, type QualityLevel } from "../../rendering/render-quality.ts";
import { useInterfaceStore } from "../interface/interface-store.ts";
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

function readSeed(text: string): number | null {
  const seed = Number(text.trim());

  if (!Number.isInteger(seed) || seed < 1 || seed > LARGEST_SEED) {
    return null;
  }

  return seed;
}

function useNewWorld() {
  const currentSeed = useWorldStore((state) => state.seed);
  const relaunch = useRelaunch();

  const [seedText, setSeedText] = useState(() => String(currentSeed));

  const seed = readSeed(seedText);

  function changeSeed(event: ChangeEvent<HTMLInputElement>): void {
    setSeedText(event.target.value);
  }

  function rollSeed(): void {
    setSeedText(String(randomSeed()));
  }

  function createWorld(): void {
    if (seed !== null) {
      relaunch({ seed });
    }
  }

  return { changeSeed, createWorld, isValid: seed !== null, rollSeed, seedText };
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
  const { changeSeed, createWorld, isValid, rollSeed, seedText } = useNewWorld();

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-veil p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="font-semibold text-ink text-sm">New world</h3>

        <p className="text-ink-muted text-xs">Every number grows a different island. The current one is lost.</p>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-full bg-white/70 px-4 text-sm focus-within:ring-2 focus-within:ring-dawn">
          <span className="text-ink-muted">Seed</span>

          <input
            className="tabular h-9 min-w-0 flex-1 bg-transparent text-ink outline-none"
            inputMode="numeric"
            onChange={changeSeed}
            value={seedText}
          />
        </label>

        <IconButton icon={<Dices aria-hidden="true" size={18} />} label="Random seed" onClick={rollSeed} />

        <TextButton disabled={!isValid} onClick={createWorld} tone="accent">
          Create
        </TextButton>
      </div>
    </div>
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
