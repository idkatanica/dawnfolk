import { Info } from "lucide-react";
import { useEffect } from "react";
import { cn } from "../../design/cn.ts";
import { GameIcon } from "../../design/game-icon.tsx";
import { CHRONICLE_ICONS } from "../journal/chronicle-icons.ts";
import { dismissNotice, useWorldStore, type WorldNotice } from "../world/world-store.ts";

const NOTICE_SECONDS = 7;

function useDismissLater(id: number): void {
  useEffect(() => {
    const timer = window.setTimeout(() => dismissNotice(id), NOTICE_SECONDS * 1000);

    return () => window.clearTimeout(timer);
  }, [id]);
}

function NoticeIcon({ notice }: { readonly notice: WorldNotice }) {
  if (notice.category === "notice") {
    return <Info aria-hidden="true" className="shrink-0 text-ink-soft" size={20} />;
  }

  return <GameIcon name={CHRONICLE_ICONS[notice.category]} size={24} />;
}

function NoticeItem({ notice }: { readonly notice: WorldNotice }) {
  useDismissLater(notice.id);

  return (
    <li className="pointer-events-auto flex max-w-full items-center gap-2.5 rounded-full border border-paper-edge bg-paper px-4 py-2 text-ink text-sm motion-safe:animate-notice-in sm:max-w-notice">
      <NoticeIcon notice={notice} />

      <span className="leading-snug">{notice.text}</span>
    </li>
  );
}

export function NoticeFeed({ className }: { readonly className?: string | undefined }) {
  const notices = useWorldStore((state) => state.notices);

  return (
    <ol aria-live="polite" className={cn("flex flex-col items-center gap-2", className)}>
      {notices.map((notice) => (
        <NoticeItem key={notice.id} notice={notice} />
      ))}
    </ol>
  );
}
