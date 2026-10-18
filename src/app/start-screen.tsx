import { ArrowRight } from "lucide-react";
import type { FormEvent } from "react";
import { TextButton } from "../design/buttons.tsx";
import { Logo } from "../design/logo.tsx";
import { useWorldDraft } from "../features/new-world/use-world-draft.ts";
import { NameField, SeedField, ShapeChoice } from "../features/new-world/world-fields.tsx";
import { useLaunchStore } from "./launch-store.ts";

function useStartScreen() {
  const launch = useLaunchStore((state) => state.launch);
  const relaunch = useLaunchStore((state) => state.relaunch);

  const draft = useWorldDraft(launch);

  function begin(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (draft.choice !== null) {
      relaunch(draft.choice);
    }
  }

  return { begin, draft };
}

export function StartScreen() {
  const { begin, draft } = useStartScreen();

  return (
    <div className="absolute inset-0 overflow-y-auto bg-sky">
      <div className="flex min-h-full flex-col items-center justify-center gap-8 p-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo className="size-20 text-pine" />

          <div className="flex flex-col gap-1">
            <p className="text-3xl text-ink">Dawnfolk</p>

            <p className="text-ink-soft text-sm">Guide the first tribes of a floating island.</p>
          </div>
        </header>

        <form
          aria-label="New world"
          className="flex w-full max-w-sm flex-col gap-4 rounded-island bg-veil p-5 ring-1 ring-white/40 backdrop-blur-xl backdrop-saturate-150"
          onSubmit={begin}
        >
          <h2 className="font-semibold text-ink text-lg">New world</h2>

          <NameField onChange={draft.changeName} onRoll={draft.rollName} value={draft.nameText} />

          <ShapeChoice onChange={draft.changeShape} value={draft.shape} />

          <SeedField onChange={draft.changeSeed} onRoll={draft.rollSeed} value={draft.seedText} />

          <TextButton className="w-full" disabled={draft.choice === null} tone="accent" type="submit">
            Grow the island
            <ArrowRight aria-hidden="true" size={16} />
          </TextButton>
        </form>
      </div>
    </div>
  );
}
