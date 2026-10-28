import { ArrowLeft } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import tallPoster from "../../app/start-backdrop/tall.webp";
import widePoster from "../../app/start-backdrop/wide.webp";
import { cn } from "../../design/cn.ts";
import { Logo } from "../../design/logo.tsx";
import privacyText from "./privacy.md?raw";

const SHEET_CLASS = "rounded-island border border-paper-edge bg-paper";

export function PrivacyPage() {
  return (
    <div className="relative min-h-dvh">
      <picture>
        <source media="(orientation: portrait)" srcSet={tallPoster} />

        <img alt="" className="fixed inset-0 size-full object-cover" height={1080} src={widePoster} width={1920} />
      </picture>

      <div className="relative mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:py-12">
        <header className={cn(SHEET_CLASS, "flex items-center justify-between gap-4 px-5 py-4 sm:px-6")}>
          <a
            className="flex min-w-0 items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-dawn sm:gap-4"
            href="/"
          >
            <Logo className="size-12 shrink-0 sm:size-14" />

            <span className="font-light text-3xl text-ink sm:text-4xl">Dawnfolk</span>
          </a>

          <a
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-paper-hover font-medium text-ink text-sm outline-none transition-colors duration-150 hover:bg-paper-press focus-visible:ring-2 focus-visible:ring-dawn max-sm:w-10 sm:px-4"
            href="/"
          >
            <ArrowLeft aria-hidden="true" size={16} />

            <span className="max-sm:sr-only">Back to the game</span>
          </a>
        </header>

        <main className={SHEET_CLASS}>
          <article className="prose prose-zinc max-w-none p-6 prose-a:text-dawn-strong prose-headings:text-ink sm:p-10">
            <Markdown remarkPlugins={[remarkGfm]}>{privacyText}</Markdown>
          </article>
        </main>
      </div>
    </div>
  );
}
