import { GameIcon } from "../../design/game-icon.tsx";
import type { GoalView } from "../../simulation/frame.ts";

export function GoalNeed({ goal }: { readonly goal: GoalView | null }) {
  if (goal === null || !goal.isBlocked || goal.need === null) {
    return null;
  }

  return (
    <span className="text-dawn-strong flex items-center gap-1 text-xs">
      <GameIcon name="workshop" size={18} />
      {`Needs ${goal.need}`}
    </span>
  );
}
