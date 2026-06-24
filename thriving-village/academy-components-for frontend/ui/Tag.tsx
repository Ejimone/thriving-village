"use client";

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Filter chip / tag. Pill-shaped, selectable, optionally removable. */
type Props = React.HTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  /** CSS color when selected (otherwise selects to black). */
  accent?: string;
  onRemove?: () => void;
};

export function Tag({
  selected = false,
  accent,
  onRemove,
  className,
  style,
  children,
  ...rest
}: Props) {
  const accentSelected = selected && accent;
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-[7px] font-medium text-sm px-[15px] py-[7px] rounded-pill border-[1.5px] cursor-pointer select-none transition-all duration-150 [letter-spacing:var(--tv-track-tight)]",
        !selected && "bg-transparent text-gray-700 border-gray-300 hover:border-black hover:text-black",
        selected && !accent && "bg-black text-white border-black",
        className,
      )}
      style={
        accentSelected
          ? { background: accent, color: "#0A0A0A", borderColor: accent, ...style }
          : style
      }
      {...rest}
    >
      {children}
      {onRemove && (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="inline-flex opacity-70 hover:opacity-100"
        >
          <X size={14} />
        </span>
      )}
    </button>
  );
}
