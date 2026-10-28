import { ArrowLeft, ArrowRight } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { IconButton, TextButton } from "../design/buttons.tsx";
import { Island } from "../design/island.tsx";
import { Logo } from "../design/logo.tsx";
import { useWorldDraft } from "../features/new-world/use-world-draft.ts";
import { NameField, SeedField, ShapeChoice } from "../features/new-world/world-fields.tsx";
import { ProjectLinks } from "../features/project/project-links.tsx";
import { SavedWorldRows } from "../features/saves/saved-world-list.tsx";
import { useSavesStore } from "../features/saves/saves-store.ts";
import { loadGameEngine, loadHud } from "./engine-launcher.ts";
import { useLaunchStore } from "./launch-store.ts";
import { StartBackdrop } from "./start-backdrop.tsx";

type CardView = "home" | "new" | "worlds";

const BIG_BUTTON_CLASS = "h-12 pointer-coarse:h-12 text-base";

interface SubviewProps {
  readonly children: ReactNode;
  readonly onBack: (() => void) | null;
  readonly title: string;
}

function Subview({ children, onBack, title }: SubviewProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        {onBack === null ? null : (
          <IconButton
            className="-ml-2"
            icon={<ArrowLeft aria-hidden="true" size={18} />}
            label="Back"
            onClick={onBack}
          />
        )}

        <h2 className="font-bold text-ink text-xl">{title}</h2>
      </div>

      {children}
    </div>
  );
}

function NewWorldForm() {
  const launch = useLaunchStore((state) => state.launch);
  const createWorld = useLaunchStore((state) => state.createWorld);

  const draft = useWorldDraft(launch, createWorld);

  return (
    <form aria-label="New world" className="flex flex-col gap-5" onSubmit={draft.create}>
      <NameField onChange={draft.changeName} onRoll={draft.rollName} value={draft.nameText} />

      <ShapeChoice onChange={draft.changeShape} value={draft.shape} />

      <SeedField onChange={draft.changeSeed} onRoll={draft.rollSeed} value={draft.seedText} />

      <TextButton className={BIG_BUTTON_CLASS} disabled={draft.choice === null} tone="accent" type="submit">
        Grow the island
        <ArrowRight aria-hidden="true" size={18} />
      </TextButton>
    </form>
  );
}

function useTitleCard() {
  const worlds = useSavesStore((state) => state.worlds);
  const continueWorld = useLaunchStore((state) => state.continueWorld);
  const [view, setView] = useState<CardView>("home");

  const latest = worlds.find((world) => world.isLoadable);

  function goHome(): void {
    setView("home");
  }

  function showNewWorld(): void {
    setView("new");
  }

  function showWorlds(): void {
    setView("worlds");
  }

  function continueLatest(): void {
    if (latest !== undefined) {
      continueWorld(latest.id, latest);
    }
  }

  return { continueLatest, goHome, hasWorlds: worlds.length > 0, latest, showNewWorld, showWorlds, view };
}

function TitleCard() {
  const { continueLatest, goHome, hasWorlds, latest, showNewWorld, showWorlds, view } = useTitleCard();

  if (!hasWorlds || view === "new") {
    return (
      <Subview onBack={hasWorlds ? goHome : null} title="New world">
        <NewWorldForm />
      </Subview>
    );
  }

  if (view === "worlds") {
    return (
      <Subview onBack={goHome} title="Your worlds">
        <SavedWorldRows />
      </Subview>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {latest === undefined ? null : (
        <TextButton className={BIG_BUTTON_CLASS} onClick={continueLatest} tone="accent">
          Continue {latest.name}
          <ArrowRight aria-hidden="true" size={18} />
        </TextButton>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextButton className={`${BIG_BUTTON_CLASS} border border-paper-edge`} onClick={showNewWorld} tone="quiet">
          New world
        </TextButton>

        <TextButton className={`${BIG_BUTTON_CLASS} border border-paper-edge`} onClick={showWorlds} tone="quiet">
          All worlds
        </TextButton>
      </div>
    </div>
  );
}

export function StartScreen() {
  const refresh = useSavesStore((state) => state.refresh);

  useEffect(() => {
    refresh().catch(() => undefined);
    Promise.all([loadGameEngine(), loadHud()]).catch((error: unknown) =>
      console.warn("The game could not be loaded ahead", error)
    );
  }, [refresh]);

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <StartBackdrop />

      <main className="relative flex min-h-full flex-col items-center justify-end gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center sm:p-8">
        <Island className="flex w-full max-w-md flex-col gap-6 p-7">
          <header className="flex flex-col items-center gap-2 text-center">
            <Logo className="size-16" />

            <h1 className="font-extrabold text-4xl text-ink tracking-tight">Dawnfolk</h1>

            <p className="text-ink-soft">Guide the first tribes of a floating island.</p>
          </header>

          <hr className="border-line" />

          <TitleCard />
        </Island>

        <Island className="px-2 py-1.5">
          <ProjectLinks />
        </Island>
      </main>
    </div>
  );
}
