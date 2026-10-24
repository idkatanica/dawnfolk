import type { ReactNode } from "react";

interface Fact {
  readonly label: string;
  readonly value: ReactNode;
}

function FactRow({ fact }: { readonly fact: Fact }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-ink-soft text-xs">{fact.label}</dt>

      <dd className="text-right font-medium text-ink text-sm tabular-nums">{fact.value}</dd>
    </div>
  );
}

export function FactList({ facts }: { readonly facts: readonly Fact[] }) {
  return (
    <dl className="divide-y divide-line">
      {facts.map((fact) => (
        <FactRow fact={fact} key={fact.label} />
      ))}
    </dl>
  );
}
