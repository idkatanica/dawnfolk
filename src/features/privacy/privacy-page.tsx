import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Logo } from "../../design/logo.tsx";
import privacyText from "./privacy.md?raw";

const LINK_CLASS = "font-medium text-dawn-strong underline decoration-dawn/40 underline-offset-2 hover:decoration-dawn";

function isOwnPage(href: string | undefined): boolean {
  return href === undefined || href.startsWith("/") || href.startsWith("#");
}

function PolicyLink({ children, href, node: _node, ...props }: ComponentProps<"a"> & { readonly node?: unknown }) {
  if (isOwnPage(href)) {
    return (
      <a {...props} className={LINK_CLASS} href={href}>
        {children}
      </a>
    );
  }

  return (
    <a {...props} className={LINK_CLASS} href={href} rel="noopener" target="_blank">
      {children}
    </a>
  );
}

const POLICY_COMPONENTS: Components = {
  a: PolicyLink,
  h1: ({ children }) => <h1 className="text-balance font-semibold text-3xl text-ink">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-6 text-balance font-semibold text-ink text-xl">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2 font-semibold text-base text-ink">{children}</h3>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  p: ({ children }) => <p className="text-ink-soft leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-paper-edge">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  td: ({ children }) => <td className="border-paper-edge border-t px-3 py-2 align-top text-ink-soft">{children}</td>,
  th: ({ children }) => <th className="bg-paper-hover px-3 py-2 font-semibold text-ink">{children}</th>,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-soft">{children}</ul>,
};

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

        <article className="flex flex-col gap-4 rounded-island border border-paper-edge bg-paper p-6 sm:p-10">
          <div aria-hidden="true" className="[&_svg]:size-12">
            <Logo />
          </div>

          <Markdown components={POLICY_COMPONENTS} remarkPlugins={[remarkGfm]}>
            {privacyText}
          </Markdown>
        </article>
      </main>
    </div>
  );
}
