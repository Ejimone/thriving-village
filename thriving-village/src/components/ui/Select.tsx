import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { label: string; value: string };

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label?: string;
  hint?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
};

export const Select = React.forwardRef<HTMLSelectElement, Props>(function Select(
  { label, hint, error, options, placeholder, id, className, ...rest },
  ref,
) {
  const inputId =
    id || (label ? `tv-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  return (
    <label htmlFor={inputId} className="flex flex-col gap-1.5 font-sans w-full">
      {label && (
        <span className="text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
          {label}
        </span>
      )}
      <span
        className={cn(
          "relative flex items-center bg-white rounded-sm border-[1.5px] transition-colors duration-150 focus-within:border-black",
          error ? "border-error" : "border-gray-300",
        )}
      >
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "appearance-none flex-1 bg-transparent border-none outline-none font-sans text-base text-black py-3 pl-3.5 pr-10 cursor-pointer [letter-spacing:var(--tv-track-tight)]",
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-3.5 text-gray-500"
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
