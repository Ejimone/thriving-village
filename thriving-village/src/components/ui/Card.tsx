import React from "react";
import { cn } from "@/lib/utils";

/** Surface card. Generous 20px radius, restrained neutral shadow, no colored glow. */
type Variant = "default" | "flat" | "inverse";

const variants: Record<Variant, string> = {
  default: "bg-white border border-gray-200 shadow-md",
  flat: "bg-white border border-gray-200 shadow-none",
  inverse: "bg-black text-white border border-black shadow-lg",
};

type Props = React.HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  /**
   * Default 24px padding (matches the design system's space-5). Set false when
   * the card supplies its own inner padding (e.g. image + body layouts).
   */
  padded?: boolean;
};

export function Card({
  variant = "default",
  padded = true,
  className,
  children,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        "rounded-card overflow-hidden",
        padded && "p-6",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
