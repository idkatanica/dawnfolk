import { Logo } from "../design/logo.tsx";
import type { GenerationProgress, GenerationStage } from "../generation/generation-options.ts";
import { useEngineStore } from "./engine-store.ts";
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

interface LoadingMessageProps {
  readonly name: string;
  readonly progress: GenerationProgress | null;
}

function LoadingMessage({ name, progress }: LoadingMessageProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center" role="status">
      <Logo className="size-20 text-pine" />

      <p className="text-3xl text-ink">{name}</p>

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
  const name = useLaunchStore((state) => state.launch.name);

  if (status.kind === "ready") {
    return null;
  }

  return (
    <div className="absolute inset-0 grid place-items-center bg-sky p-6">
      {status.kind === "failed" ? (
        <FailureMessage message={status.message} />
      ) : (
        <LoadingMessage name={name} progress={status.progress} />
      )}
    </div>
  );
}
