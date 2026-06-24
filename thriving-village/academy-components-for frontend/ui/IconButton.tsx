import React from "react";
import { cn } from "@/lib/utils";

/** Circular icon button. Always a perfect circle (pill rule). */
type Variant = "solid" | "outline" | "ghost" | "inverse";
type Size = "sm" | "md" | "lg";

const dims: Record<Size, string> = {
  sm: "w-[34px] h-[34px]",
  md: "w-11 h-11",
  lg: "w-[54px] h-[54px]",
};

const variants: Record<Variant, string> = {
  solid: "bg-black text-white border-black hover:bg-gray-900",
  inverse: "bg-white text-black border-white hover:bg-gray-100",
  outline: "bg-transparent text-black border-black hover:bg-black hover:text-white",
  ghost: "bg-transparent text-black border-transparent hover:bg-gray-100",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function IconButton({
  variant = "outline",
  size = "md",
  className,
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-pill border-[1.5px] cursor-pointer transition-[background-color,transform] duration-150 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed",
        dims[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
