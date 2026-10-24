import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Pause, Play } from "lucide-react";
import { useSendCommand } from "../../app/use-engine.ts";
import { IconButton } from "../../design/buttons.tsx";
import { cn } from "../../design/cn.ts";
import { SEGMENT, SEGMENT_TRACK } from "../../design/segmented.ts";
import { SIMULATION_SPEEDS } from "../../simulation/tick.ts";
import { useWorldStore } from "../world/world-store.ts";

function SpeedOption({ speed }: { readonly speed: number }) {
  return (
    <Toggle
      aria-label={`Speed ${speed} times`}
      className={cn(SEGMENT, "h-8 min-w-8 px-1.5 font-semibold tabular-nums lg:min-w-9 lg:px-2")}
      value={String(speed)}
    >
      {speed}×
    </Toggle>
  );
}

function useTimeControls() {
  const isPaused = useWorldStore((state) => state.snapshot?.isPaused === true);
  const speed = useWorldStore((state) => state.snapshot?.speed);
  const send = useSendCommand();

  function togglePause(): void {
    send({ isPaused: !isPaused, type: "setPaused" });
  }

  function changeSpeed(values: string[]): void {
    const [selected] = values;

    if (selected === undefined) {
      return;
    }

    send({ speed: Number(selected), type: "setSpeed" });

    if (isPaused) {
      send({ isPaused: false, type: "setPaused" });
    }
  }

  return { changeSpeed, isPaused, speed, togglePause };
}

export function TimeControls({ className }: { readonly className?: string | undefined }) {
  const { changeSpeed, isPaused, speed, togglePause } = useTimeControls();

  const pressedSpeeds = isPaused || speed === undefined ? [] : [String(speed)];
  const PlaybackIcon = isPaused ? Play : Pause;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <IconButton
        icon={<PlaybackIcon aria-hidden="true" size={18} />}
        label={isPaused ? "Resume" : "Pause"}
        onClick={togglePause}
        tone={isPaused ? "accent" : "plain"}
      />

      <ToggleGroup
        aria-label="Game speed"
        className={cn(SEGMENT_TRACK, "p-1")}
        onValueChange={changeSpeed}
        value={pressedSpeeds}
      >
        {SIMULATION_SPEEDS.map((option) => (
          <SpeedOption key={option} speed={option} />
        ))}
      </ToggleGroup>
    </div>
  );
}
