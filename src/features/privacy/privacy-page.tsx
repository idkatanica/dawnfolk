import { ArrowLeft } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Logo } from "../../design/logo.tsx";
import privacyText from "./privacy.md?raw";

export function PrivacyPage() {
  return (
    <div className="min-h-dvh px-4 py-8 sm:py-14">
      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        <a
          className="inline-flex items-center gap-2 self-start rounded-full py-1 pr-3 font-medium text-ink-soft text-sm hover:text-ink"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Back to Dawnfolk
        </a>

        <article className="prose prose-slate rounded-island border border-paper-edge bg-paper p-6 prose-a:text-dawn-strong prose-headings:text-ink sm:p-10">
          <Logo />

          <Markdown remarkPlugins={[remarkGfm]}>{privacyText}</Markdown>
        </article>
      </main>
    </div>
  );
}
