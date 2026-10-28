import { ArrowLeft } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import tallPoster from "../../app/start-backdrop/tall.webp";
import widePoster from "../../app/start-backdrop/wide.webp";
import { cn } from "../../design/cn.ts";
import privacyText from "./privacy.md?raw";

const ISLAND_CLASS = "rounded-island border border-paper-edge bg-paper";

export function PrivacyPage() {
  return (
    <div className="relative min-h-dvh">
      <picture>
        <source media="(orientation: portrait)" srcSet={tallPoster} />

        <img alt="" className="fixed inset-0 size-full object-cover" height={1080} src={widePoster} width={1920} />
      </picture>

      <div className="relative mx-auto flex max-w-4xl flex-col gap-3 px-4 py-6 sm:py-12">
        <a
          className={cn(
            ISLAND_CLASS,
            "inline-flex h-11 items-center gap-2 self-start px-4 font-semibold text-ink text-sm outline-none transition-colors duration-150 hover:text-dawn-strong focus-visible:ring-2 focus-visible:ring-dawn"
          )}
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Back to the game
        </a>

        <main className={ISLAND_CLASS}>
          <article className="prose prose-zinc max-w-none p-6 prose-a:text-dawn-strong prose-headings:text-ink sm:p-12">
            <Markdown remarkPlugins={[remarkGfm]}>{privacyText}</Markdown>
          </article>
        </main>
      </div>
    </div>
  );
}
