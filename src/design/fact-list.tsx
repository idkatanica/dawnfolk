import type { ReactNode } from "react";
import { cn } from "./cn.ts";

interface Fact {
  readonly label: string;
  readonly value: ReactNode;
}

function FactRow({ fact }: { readonly fact: Fact }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-ink-soft text-xs">{fact.label}</dt>

      <dd className="tabular text-right font-medium text-ink text-sm">{fact.value}</dd>
    </div>
  );
}

export function FactList({
  className,
  facts,
}: {
  readonly className?: string | undefined;
  readonly facts: readonly Fact[];
}) {
  return (
    <dl className={cn("flex flex-col divide-y divide-line", className)}>
      {facts.map((fact) => (
        <FactRow fact={fact} key={fact.label} />
      ))}
    </dl>
  );
}
