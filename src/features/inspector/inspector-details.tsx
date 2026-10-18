import { Flame } from "lucide-react";
import { FOOD_KINDS } from "../../content/resources.ts";
import { cn } from "../../design/cn.ts";
import { FactList } from "../../design/fact-list.tsx";
import { formatPercent } from "../../design/format.ts";
import { MeterBar } from "../../design/meter-bar.tsx";
import type {
  AnimalInspection,
  BuildingInspection,
  CellInspection,
  PersonInspection,
  PlantDescription,
  TribeInspection,
} from "../../simulation/inspection.ts";

const LIT_FUEL = 0.02;

function Badge({ children, tone }: { readonly children: string; readonly tone: "ember" | "meadow" | "muted" }) {
  return (
    <span
      className={cn("inline-flex h-6 items-center rounded-full px-2.5 font-medium text-xs", {
        "bg-ember-soft text-ember": tone === "ember",
        "bg-ink/8 text-ink-soft": tone === "muted",
        "bg-meadow-soft text-meadow": tone === "meadow",
      })}
    >
      {children}
    </span>
  );
}

export function PersonDetails({ person }: { readonly person: PersonInspection }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink text-sm">{person.isAlive ? person.activity : "Has passed away"}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <MeterBar label="Health" tone="ember" value={person.health} valueText={formatPercent(person.health)} />

        <MeterBar label="Fed" tone="gold" value={1 - person.hunger} valueText={formatPercent(1 - person.hunger)} />

        <MeterBar label="Warmth" tone="dawn" value={person.warmth} valueText={formatPercent(person.warmth)} />

        <MeterBar label="Energy" tone="meadow" value={person.energy} valueText={formatPercent(person.energy)} />
      </div>
    </div>
  );
}

export function AnimalDetails({ animal }: { readonly animal: AnimalInspection }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-ink text-sm">{animal.activity}</p>

      <MeterBar label="Health" tone="ember" value={animal.health} valueText={formatPercent(animal.health)} />
    </div>
  );
}

function BuildingState({ building }: { readonly building: BuildingInspection }) {
  if (building.isBurning) {
    return <Badge tone="ember">On fire</Badge>;
  }

  if (building.progress < 1) {
    return <Badge tone="muted">{`Being built · ${formatPercent(building.progress)}`}</Badge>;
  }

  return <Badge tone="meadow">Standing</Badge>;
}

function CampfireFuel({ building }: { readonly building: BuildingInspection }) {
  if (building.name !== "Campfire" || building.progress < 1) {
    return null;
  }

  const label = building.fuel > LIT_FUEL ? "Firewood" : "Gone out";

  return <MeterBar label={label} tone="dawn" value={building.fuel} valueText={formatPercent(building.fuel)} />;
}

export function BuildingDetails({ building }: { readonly building: BuildingInspection }) {
  return (
    <div className="flex flex-col gap-3">
      <BuildingState building={building} />

      <MeterBar label="Condition" tone="meadow" value={building.health} valueText={formatPercent(building.health)} />

      <CampfireFuel building={building} />
    </div>
  );
}

function PlantChip({ plant }: { readonly plant: PlantDescription }) {
  return (
    <Badge tone={plant.isBurnt ? "ember" : "meadow"}>{plant.isBurnt ? `${plant.name} (burnt)` : plant.name}</Badge>
  );
}

function PlantList({ plants }: { readonly plants: readonly PlantDescription[] }) {
  if (plants.length === 0) {
    return <p className="text-ink-muted text-xs">Nothing grows here.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {plants.map((plant, index) => (
        <PlantChip key={`${plant.name}-${String(index)}`} plant={plant} />
      ))}
    </div>
  );
}

function FireWarning({ cell }: { readonly cell: CellInspection }) {
  if (cell.fire <= 0.05) {
    return null;
  }

  return (
    <p className="flex items-center gap-1.5 font-medium text-ember text-sm">
      <Flame aria-hidden="true" size={15} />
      Burning
    </p>
  );
}

export function CellDetails({ cell }: { readonly cell: CellInspection }) {
  const facts = [
    { label: "Ground", value: cell.groundName },
    { label: "Height", value: `${Math.round(cell.height)} m` },
    { label: "Temperature", value: `${Math.round(cell.temperature)} °C` },
    { label: "Water depth", value: cell.waterDepth > 0.05 ? `${cell.waterDepth.toFixed(1)} m` : "Dry" },
    { label: "Snow", value: formatPercent(cell.snow) },
    { label: "Wetness", value: formatPercent(cell.wetness) },
    { label: "Scorched", value: formatPercent(cell.scorch) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <FireWarning cell={cell} />

      <FactList facts={facts} />

      <PlantList plants={cell.plants} />
    </div>
  );
}

function NextDiscovery({ tribe }: { readonly tribe: TribeInspection }) {
  const { knowledge, nextTechnology } = tribe.summary;

  if (nextTechnology === null) {
    return <p className="text-ink-muted text-xs">Every discovery is made.</p>;
  }

  const progress = Math.min(1, knowledge / nextTechnology.cost);

  return (
    <MeterBar label={`Next: ${nextTechnology.name}`} tone="lake" value={progress} valueText={formatPercent(progress)} />
  );
}

export function TribeDetails({ tribe }: { readonly tribe: TribeInspection }) {
  const { summary } = tribe;

  const facts = [
    { label: "Era", value: summary.eraName },
    { label: "People", value: `${summary.population} (${summary.children} children)` },
    { label: "Births · deaths", value: `${summary.births} · ${summary.deaths}` },
    { label: "Food", value: Math.round(FOOD_KINDS.reduce((total, kind) => total + summary.stock[kind], 0)) },
    { label: "Wood", value: Math.round(summary.stock.wood) },
    { label: "Stone", value: Math.round(summary.stock.stone) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <FactList facts={facts} />

      <MeterBar
        label="Faith"
        tone="gold"
        value={Math.min(1, summary.faith / 100)}
        valueText={String(Math.round(summary.faith))}
      />

      <NextDiscovery tribe={tribe} />

      <div className="flex flex-wrap gap-1.5">
        {summary.technologies.map((name) => (
          <Badge key={name} tone="muted">
            {name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
