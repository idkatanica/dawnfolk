import { ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { TextButton } from "../design/buttons.tsx";
import { Logo } from "../design/logo.tsx";
import { useWorldDraft } from "../features/new-world/use-world-draft.ts";
import { NameField, SeedField, ShapeChoice } from "../features/new-world/world-fields.tsx";
import { loadGameEngine } from "./engine-launcher.ts";
import { useLaunchStore } from "./launch-store.ts";

export function StartScreen() {
  const launch = useLaunchStore((state) => state.launch);
  const relaunch = useLaunchStore((state) => state.relaunch);

  const draft = useWorldDraft(launch, relaunch);

  useEffect(() => {
    loadGameEngine().catch((error: unknown) => console.warn("The engine could not be loaded ahead", error));
  }, []);

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="flex min-h-full flex-col items-center justify-center gap-8 p-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo />

          <div className="flex flex-col gap-1">
            <p className="text-3xl text-ink">Dawnfolk</p>

            <p className="text-ink-soft text-sm">Guide the first tribes of a floating island.</p>
          </div>
        </header>

        <form
          aria-label="New world"
          className="flex w-full max-w-sm flex-col gap-4 rounded-island bg-veil p-5 ring-1 ring-white/40 backdrop-blur-xl backdrop-saturate-150"
          onSubmit={draft.create}
        >
          <h2 className="font-semibold text-ink text-lg">New world</h2>

          <NameField onChange={draft.changeName} onRoll={draft.rollName} value={draft.nameText} />

          <ShapeChoice onChange={draft.changeShape} value={draft.shape} />

          <SeedField onChange={draft.changeSeed} onRoll={draft.rollSeed} value={draft.seedText} />

          <TextButton disabled={draft.choice === null} tone="accent" type="submit">
            Grow the island
            <ArrowRight aria-hidden="true" size={16} />
          </TextButton>
        </form>
      </div>
    </div>
  );
}
