import React from "react";
import { cn } from "@/lib/utils";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, Props>(
  function Textarea({ label, hint, error, id, className, rows = 5, ...rest }, ref) {
    const inputId =
      id || (label ? `tv-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
    return (
      <label htmlFor={inputId} className="flex flex-col gap-1.5 font-sans w-full">
        {label && (
          <span className="text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
            {label}
          </span>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            "bg-white rounded-sm border-[1.5px] px-3.5 py-3 font-sans text-base text-black outline-none transition-colors duration-150 resize-y [letter-spacing:var(--tv-track-tight)] placeholder:text-gray-400 focus:border-black",
            error ? "border-error" : "border-gray-300",
            className,
          )}
          {...rest}
        />
        {(hint || error) && (
          <span className={cn("text-[13px]", error ? "text-error" : "text-gray-500")}>
            {error || hint}
          </span>
        )}
      </label>
    );
  },
);
