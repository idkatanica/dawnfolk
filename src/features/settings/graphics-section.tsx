import { useState } from "react";
import { useLaunchStore, type WorldChoice } from "../../app/launch-store.ts";
import { storeQuality } from "../../app/preferences.ts";
import { TextButton } from "../../design/buttons.tsx";
import { ChoiceField } from "../../design/choice-field.tsx";
import { ToggleField } from "../../design/toggle-field.tsx";
import { isQualityLevel, QUALITY_LEVELS, type QualityLevel } from "../../rendering/render-quality.ts";
import { useInterfaceStore } from "../interface/interface-store.ts";
import { useWorldDraft } from "../new-world/use-world-draft.ts";
import { NameField, SeedField, ShapeChoice } from "../new-world/world-fields.tsx";
import { SavesGroup } from "../saves/saves-group.tsx";
import { useLeaveWorld } from "../saves/use-leave-world.ts";
import { GROUP_CLASS, GroupHeading, SettingsGroup } from "./settings-group.tsx";

const QUALITY_LABELS: Readonly<Record<QualityLevel, string>> = { high: "High", low: "Light", medium: "Balanced" };

const QUALITY_OPTIONS = QUALITY_LEVELS.map((level) => ({ label: QUALITY_LABELS[level], value: level }));

function useCreateWorld() {
  const createWorld = useLaunchStore((state) => state.createWorld);
  const leaveWorld = useLeaveWorld();

  return (choice: WorldChoice) => leaveWorld(() => createWorld(choice));
}

function useQualityChoice() {
  const active = useLaunchStore((state) => state.launch.quality);
  const relaunch = useLaunchStore((state) => state.relaunch);
  const leaveWorld = useLeaveWorld();

  const [quality, setQuality] = useState(active);

  function changeQuality(value: string): void {
    if (!isQualityLevel(value)) {
      return;
    }

    setQuality(value);
    storeQuality(value);
  }

  function applyQuality(): void {
    leaveWorld(() => relaunch({ quality }));
  }

  return { applyQuality, changeQuality, hasChanged: quality !== active, quality };
}

function QualityChoice() {
  const { applyQuality, changeQuality, hasChanged, quality } = useQualityChoice();

  return (
    <SettingsGroup
      action={
        <TextButton className="h-8 px-3.5" disabled={!hasChanged} onClick={applyQuality} tone="accent">
          Apply
        </TextButton>
      }
      description="The island is saved and reopened to switch the quality."
      title="Graphics"
    >
      <ChoiceField
        description="Light suits phones and older laptops; High adds sharper shadows and more detail far away."
        label="Quality"
        onChange={changeQuality}
        options={QUALITY_OPTIONS}
        value={quality}
      />
    </SettingsGroup>
  );
}

function MapLabelsChoice() {
  const areLabelsShown = useInterfaceStore((state) => state.areLabelsShown);
  const setLabelsShown = useInterfaceStore((state) => state.setLabelsShown);

  return (
    <SettingsGroup description="Tribe banners and the names of peaks and lakes over the island." title="Display">
      <ToggleField isChecked={areLabelsShown} label="Map labels" onChange={setLabelsShown} />
    </SettingsGroup>
  );
}

function NewWorld() {
  const launch = useLaunchStore((state) => state.launch);

  const draft = useWorldDraft(launch, useCreateWorld());

  return (
    <form aria-label="New world" className={GROUP_CLASS} onSubmit={draft.create}>
      <GroupHeading
        description="Every seed grows a different island. The current one stays in your worlds."
        title="New world"
      />

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
    <>
      <SavesGroup />

      <QualityChoice />

      <MapLabelsChoice />

      <NewWorld />
    </>
  );
}
