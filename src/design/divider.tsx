import { cn } from "./cn.ts";

export function Divider({ className }: { readonly className?: string | undefined }) {
  return <span aria-hidden="true" className={cn("h-6 w-px shrink-0 bg-paper-edge", className)} />;
}
