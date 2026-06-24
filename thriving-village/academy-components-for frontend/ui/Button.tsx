import Link from "next/link";
import React from "react";
import { cn } from "@/lib/utils";

/**
 * Thriving Village Button.
 * Brand rule: buttons are FULLY ROUNDED (pill) or text-only. Never boxy,
 * never accent-filled (reads as confetti). Neutral by default.
 */
type Variant = "primary" | "inverse" | "outline" | "text";
type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "text-sm px-[18px] py-2 gap-1.5",
  md: "text-base px-[26px] py-3 gap-2",
  lg: "text-lg px-[34px] py-4 gap-2.5",
};

const variantClasses: Record<Variant, string> = {
  // 'primary' here means the neutral black fill (the workhorse CTA).
  // The reserve --tv-primary blue is intentionally not exposed as a casual variant.
  primary:
    "bg-black text-white border-transparent hover:bg-gray-900 active:scale-[0.97]",
  inverse:
    "bg-black text-white border-black hover:bg-gray-900 active:scale-[0.97]",
  outline:
    "bg-transparent text-black border-black hover:bg-black hover:text-white active:scale-[0.97]",
  text: "bg-transparent text-black border-transparent hover:text-gray-600 !rounded-none !px-0.5 !py-1",
};

const base =
  "inline-flex items-center justify-center font-semibold leading-none rounded-pill border-[1.5px] cursor-pointer whitespace-nowrap no-underline transition-[background-color,color,border-color,transform] duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none [letter-spacing:var(--tv-track-tight)]";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    fullWidth,
    iconLeft,
    iconRight,
    className,
    children,
    ...rest
  } = props;

  const classes = cn(
    base,
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && "w-full",
    className,
  );

  const inner = (
    <>
      {iconLeft}
      {children}
      {iconRight}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    };
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {inner}
    </button>
  );
}
