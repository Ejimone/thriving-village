import React from "react";
import { cn } from "@/lib/utils";

/** Text input. Soft 12px radius (not pill — pill is for buttons/tags only). */
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, prefix, id, className, ...rest },
  ref,
) {
  const inputId =
    id || (label ? `tv-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <label
      htmlFor={inputId}
      className="flex flex-col gap-1.5 font-sans w-full"
    >
      {label && (
        <span className="text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
          {label}
        </span>
      )}
      <span
        className={cn(
          "flex items-center gap-2 bg-white rounded-sm px-3.5 border-[1.5px] transition-colors duration-150 focus-within:border-black",
          error ? "border-error" : "border-gray-300",
        )}
      >
        {prefix && <span className="text-gray-500 inline-flex">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "flex-1 border-none outline-none bg-transparent font-sans text-base text-black py-3 min-w-0 [letter-spacing:var(--tv-track-tight)] placeholder:text-gray-400",
            className,
          )}
          {...rest}
        />
      </span>
      {(hint || error) && (
        <span className={cn("text-[13px]", error ? "text-error" : "text-gray-500")}>
          {error || hint}
        </span>
      )}
    </label>
  );
});
