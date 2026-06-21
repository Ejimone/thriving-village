import React from "react";
import { cn } from "@/lib/utils";

/** Avatar — circular by the pill rule. Image (grayscale), or initials fallback. */
type Props = {
  src?: string;
  name?: string;
  size?: number;
  /** Optional accent ring color. */
  ring?: string;
  className?: string;
};

export function Avatar({ src, name = "", size = 48, ring, className }: Props) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "rounded-pill overflow-hidden inline-flex items-center justify-center bg-gray-200 text-gray-700 font-semibold flex-none [letter-spacing:var(--tv-track-tight)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        boxShadow: ring
          ? `0 0 0 2.5px var(--tv-white), 0 0 0 4.5px ${ring}`
          : undefined,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover tv-photo"
        />
      ) : (
        initials
      )}
    </div>
  );
}
