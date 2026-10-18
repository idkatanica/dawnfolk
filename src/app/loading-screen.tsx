import { Logo } from "../design/logo.tsx";
import type { GenerationProgress, GenerationStage } from "../generation/world-generator.ts";
import { useEngineStore } from "./engine-store.ts";

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

function LoadingMessage({ progress }: { readonly progress: GenerationProgress | null }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center" role="status">
      <Logo className="size-20 text-pine" />

      <p className="text-3xl text-ink">Dawnfolk</p>

      <p className="text-ink-soft text-sm">{stageLabel(progress)}…</p>
    </div>
  );
}

function FailureMessage({ message }: { readonly message: string }) {
  return (
    <div className="flex max-w-md flex-col items-center gap-3 text-center" role="alert">
      <p className="text-3xl text-ink">The island could not rise</p>

      <p className="text-ink-soft text-sm">{message}</p>
    </div>
  );
}

export function LoadingScreen() {
  const status = useEngineStore((state) => state.status);

  if (status.kind === "ready") {
    return null;
  }

  if (status.kind === "failed") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-sky p-6">
        <FailureMessage message={status.message} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 grid place-items-center bg-sky p-6">
      <LoadingMessage progress={status.progress} />
    </div>
  );
}
