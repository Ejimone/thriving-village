import React from "react";
import { cn } from "@/lib/utils";

/** Small pill label. Use for team/project tags — one accent at a time. */
type Tone = "neutral" | "inverse" | "outline" | "accent";
type Size = "sm" | "md";

const sizes: Record<Size, string> = {
  sm: "text-[11px] px-[9px] py-[3px]",
  md: "text-[13px] px-[13px] py-[5px]",
};

const tones: Record<Exclude<Tone, "accent">, string> = {
  neutral: "bg-gray-150 text-gray-800 border-transparent",
  inverse: "bg-black text-white border-black",
  outline: "bg-transparent text-black border-gray-300",
};

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  size?: Size;
  /** CSS color used when tone="accent" (e.g. var(--tv-accent-orange)). */
  accent?: string;
};

export function Badge({
  tone = "neutral",
  size = "md",
  accent,
  className,
  style,
  children,
  ...rest
}: Props) {
  const isAccent = tone === "accent";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold uppercase rounded-pill border [letter-spacing:var(--tv-track-tight)]",
        sizes[size],
        !isAccent && tones[tone as Exclude<Tone, "accent">],
        isAccent && "border-transparent text-black",
        className,
      )}
      style={
        isAccent
          ? { background: accent ?? "var(--tv-accent-blue)", ...style }
          : style
      }
      {...rest}
    >
      {children}
    </span>
  );
}
