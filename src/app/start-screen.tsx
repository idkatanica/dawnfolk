import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { TextButton } from "../design/buttons.tsx";
import { Island } from "../design/island.tsx";
import { Logo } from "../design/logo.tsx";
import { useWorldDraft } from "../features/new-world/use-world-draft.ts";
import { NameField, SeedField, ShapeChoice } from "../features/new-world/world-fields.tsx";
import { ProjectLinks } from "../features/project/project-links.tsx";
import { SavedWorldList } from "../features/saves/saved-world-list.tsx";
import { loadGameEngine, loadHud } from "./engine-launcher.ts";
import { useLaunchStore } from "./launch-store.ts";
import { StartBackdrop } from "./start-backdrop.tsx";

export function StartScreen() {
  const launch = useLaunchStore((state) => state.launch);
  const createWorld = useLaunchStore((state) => state.createWorld);

  const draft = useWorldDraft(launch, createWorld);

  useEffect(() => {
    Promise.all([loadGameEngine(), loadHud()]).catch((error: unknown) =>
      console.warn("The game could not be loaded ahead", error)
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <StartBackdrop />

      <div className="relative flex min-h-full flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-8 lg:grid lg:grid-cols-[1fr_auto] lg:grid-rows-[auto_1fr_auto] lg:gap-x-10 lg:p-12">
        <header className="self-start justify-self-start">
          <Island className="flex items-center gap-4 px-6 py-5 sm:gap-5 sm:px-7 sm:py-6">
            <Logo className="size-14 shrink-0 sm:size-16" />

            <div className="flex min-w-0 flex-col gap-2">
              <p className="font-light text-4xl text-ink leading-none sm:text-6xl">Dawnfolk</p>

              <p className="text-base text-ink-soft sm:text-lg">Guide the first tribes of a floating island.</p>
            </div>
          </Island>
        </header>

        <div className="mt-auto flex w-full max-w-md flex-col gap-4 self-center sm:my-auto lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <SavedWorldList />

          <Island className="w-full">
            <form aria-label="New world" className="flex flex-col gap-5 p-6" onSubmit={draft.create}>
              <h2 className="font-semibold text-ink text-xl">New world</h2>

              <NameField onChange={draft.changeName} onRoll={draft.rollName} value={draft.nameText} />

              <ShapeChoice onChange={draft.changeShape} value={draft.shape} />

              <SeedField onChange={draft.changeSeed} onRoll={draft.rollSeed} value={draft.seedText} />

              <TextButton disabled={draft.choice === null} tone="accent" type="submit">
                Grow the island
                <ArrowRight aria-hidden="true" size={16} />
              </TextButton>
            </form>
          </Island>
        </div>

        <Island className="self-center px-2 py-1.5 lg:col-start-1 lg:row-start-3 lg:self-end lg:justify-self-start">
          <ProjectLinks />
        </Island>
      </div>
    </div>
  );
}
