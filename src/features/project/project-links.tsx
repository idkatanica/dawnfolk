import { Heart, Star } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { cn } from "../../design/cn.ts";
import { formatStars, REPOSITORY_ADDRESS, requestStars, SPONSOR_ADDRESS, useStarStore } from "./github-stars.ts";

const LINK_CLASS =
  "inline-flex h-9 pointer-coarse:h-10 items-center gap-2 rounded-full px-3 font-medium text-ink-soft text-sm outline-none transition-colors duration-150 hover:bg-paper-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-dawn";

function GitHubMark() {
  return (
    <svg aria-hidden="true" className="size-4" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function ExternalLink({
  children,
  href,
  label,
}: {
  readonly children: ReactNode;
  readonly href: string;
  readonly label: string;
}) {
  return (
    <a aria-label={label} className={LINK_CLASS} href={href} rel="noopener" target="_blank">
      {children}
    </a>
  );
}

function StarCount() {
  const stars = useStarStore((state) => state.stars);

  if (stars === null) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Star aria-hidden="true" size={14} />

      {formatStars(stars)}
    </span>
  );
}

export function ProjectLinks({ className }: { readonly className?: string | undefined }) {
  useEffect(requestStars, []);

  return (
    <nav aria-label="Project" className={cn("flex flex-wrap items-center justify-center gap-1", className)}>
      <ExternalLink href={REPOSITORY_ADDRESS} label="Dawnfolk on GitHub">
        <GitHubMark />
        GitHub
        <StarCount />
      </ExternalLink>

      <ExternalLink href={SPONSOR_ADDRESS} label="Sponsor Dawnfolk">
        <Heart aria-hidden="true" size={16} />
        Sponsor
      </ExternalLink>
    </nav>
  );
}
