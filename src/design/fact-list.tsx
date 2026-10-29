import type { ReactNode } from "react";

interface Fact {
  readonly label: string;
  readonly value: ReactNode;
}

function FactRow({ fact }: { readonly fact: Fact }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-ink-soft text-xs">{fact.label}</dt>

      <dd className="text-ink text-right text-sm font-medium tabular-nums">{fact.value}</dd>
    </div>
  );
}

export function FactList({ facts }: { readonly facts: readonly Fact[] }) {
  return (
    <dl className="divide-line divide-y">
      {facts.map((fact) => {
        return <FactRow fact={fact} key={fact.label} />;
      })}
    </dl>
  );
}
