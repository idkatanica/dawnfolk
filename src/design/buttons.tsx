import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn.ts";

const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-dawn focus-visible:ring-offset-1";

export type IconButtonTone = "accent" | "plain";

export interface IconButtonProps extends Omit<ComponentProps<typeof BaseButton>, "aria-label" | "children"> {
  readonly icon: ReactNode;
  readonly isPressed?: boolean | undefined;
  readonly label: string;
  readonly tone?: IconButtonTone | undefined;
}

export function IconButton({ className, icon, isPressed, label, tone = "plain", ...props }: IconButtonProps) {
  return (
    <BaseButton
      {...props}
      aria-label={label}
      aria-pressed={isPressed}
      className={cn(
        "grid pointer-coarse:size-11 size-10 shrink-0 place-items-center rounded-full transition-colors duration-150",
        {
          "bg-dawn text-white shadow-thumb hover:bg-dawn-strong active:bg-dawn-strong": tone === "accent",
          "bg-white text-ink shadow-thumb": tone === "plain" && isPressed === true,
          "text-ink-soft hover:bg-veil hover:text-ink active:bg-veil-strong": tone === "plain" && isPressed !== true,
        },
        FOCUS_RING,
        className
      )}
    >
      {icon}
    </BaseButton>
  );
}

export type ButtonTone = "accent" | "plain" | "quiet";

export interface TextButtonProps extends ComponentProps<typeof BaseButton> {
  readonly tone?: ButtonTone;
}

export function TextButton({ className, tone = "plain", ...props }: TextButtonProps) {
  return (
    <BaseButton
      {...props}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 font-medium text-sm transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        {
          "bg-dawn text-white hover:bg-dawn-strong": tone === "accent",
          "bg-veil text-ink hover:bg-veil-strong": tone === "plain",
          "text-ink-soft hover:bg-veil hover:text-ink": tone === "quiet",
        },
        FOCUS_RING,
        className
      )}
    />
  );
}
