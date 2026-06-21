import React from "react";

/** Thriving Village logo — icon mark (merged T+V), wordmark, or lockup. */
type Variant = "icon" | "wordmark" | "lockup";

type Props = {
  variant?: Variant;
  color?: "black" | "white";
  font?: "sans" | "serif";
  height?: number;
  className?: string;
};

export function Logo({
  variant = "lockup",
  color = "black",
  font = "sans",
  height = 32,
  className,
}: Props) {
  const fill = color === "white" ? "#FFFFFF" : "#0A0A0A";

  const mark = (
    <svg
      viewBox="0 0 242 242"
      height={height}
      width={height}
      style={{ display: "block", flex: "none" }}
      aria-hidden="true"
    >
      <path
        d="M242 30.25V0H136.125H105.875H0V30.25H105.875V204.79L35.6611 92.4295H0L92.8022 240.926L93.4749 242H105.875H109.907H131.788H136.125H148.428L149.101 240.926L241.898 92.4295H206.237L136.125 204.626V30.25H242Z"
        fill={fill}
      />
    </svg>
  );

  const word = (
    <span
      className={font === "serif" ? "font-serif" : "font-sans"}
      style={{
        fontWeight: 700,
        letterSpacing: font === "serif" ? "0" : "var(--tv-track-tight)",
        fontSize: height * 0.86,
        lineHeight: 1,
        color: fill,
      }}
    >
      thrivingvillage
    </span>
  );

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: height * 0.32,
      }}
    >
      {variant !== "wordmark" && mark}
      {variant !== "icon" && word}
    </span>
  );
}
