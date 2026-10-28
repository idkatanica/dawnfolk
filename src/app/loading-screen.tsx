import { RotateCcw } from "lucide-react";
import { TextButton } from "../design/buttons.tsx";
import { Island } from "../design/island.tsx";
import type { GenerationProgress, GenerationStage } from "../generation/generation-options.ts";
import { CloudSeaBackdrop } from "./cloud-sea-backdrop.tsx";
import type { EngineStatus } from "./engine-launcher.ts";
import { useEngineStore } from "./engine-store.ts";
import { IslandSketchView } from "./island-sketch-view.tsx";
import { useLaunchStore } from "./launch-store.ts";

const STAGE_LABELS: Readonly<Record<GenerationStage, string>> = {
  climate: "Settling the climate",
  erosion: "Weathering the mountains",
  relief: "Raising the island",
  vegetation: "Planting the forests",
  water: "Filling rivers and lakes",
};

function stageLabel(progress: GenerationProgress | null): string {
  if (progress === null) {
    return "Waking the world";
  }

  return STAGE_LABELS[progress.stage];
}

function startAgain(): void {
  useLaunchStore.getState().relaunch({});
}

interface LoadingSceneProps {
  readonly name: string;
  readonly progress: GenerationProgress | null;
  readonly seed: number;
}

function LoadingScene({ name, progress, seed }: LoadingSceneProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div aria-hidden="true" className="animate-descend absolute inset-0">
        <CloudSeaBackdrop seed={seed} />

        <div className="absolute inset-0 grid place-items-center">
          <IslandSketchView className="size-[min(72dvh,86vw)]" island={progress === null ? null : progress.island} />
        </div>
      </div>

      <div className="p-safe absolute inset-x-0 bottom-0 flex justify-center">
        <Island className="flex max-w-full flex-col items-center gap-0.5 px-6 py-3 text-center">
          <div role="status">
            <h2 className="text-ink text-xl wrap-break-word">{name}</h2>

            <p className="text-ink-soft text-sm">{stageLabel(progress)}…</p>
          </div>
        </Island>
      </div>
    </div>
  );
}

interface FailureMessageProps {
  readonly message: string;
  readonly title: string;
}

function FailureMessage({ message, title }: FailureMessageProps) {
  return (
    <div className="flex max-w-md flex-col items-center gap-3 text-center" role="alert">
      <h2 className="text-ink text-3xl">{title}</h2>

      <p className="text-ink-soft text-sm">{message}</p>
    </div>
  );
}

function StoppedMessage({ message }: { readonly message: string }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <FailureMessage message={message} title="The simulation stopped" />

      <TextButton onClick={startAgain} tone="accent">
        <RotateCcw aria-hidden="true" size={16} />
        Start again
      </TextButton>
    </div>
  );
}

function StatusMessage({ status }: { readonly status: Exclude<EngineStatus, { kind: "ready" }> }) {
  const { name, seed } = useLaunchStore((state) => state.launch);

  switch (status.kind) {
    case "failed":
      return <FailureMessage message={status.message} title="The island could not rise" />;
    case "loading":
      return <LoadingScene name={name} progress={status.progress} seed={seed} />;
    case "stopped":
      return <StoppedMessage message={status.message} />;
    default:
      return status satisfies never;
  }
}

export function LoadingScreen() {
  const status = useEngineStore((state) => state.status);

  if (status.kind === "ready") {
    return null;
  }

  return (
    <div className="bg-canvas absolute inset-0 grid place-items-center p-6">
      <StatusMessage status={status} />
    </div>
  );
}
