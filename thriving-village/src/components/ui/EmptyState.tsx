import React from "react";

/** Empty state — used when filters return nothing or a list is empty. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 rounded-card border border-dashed border-gray-300 bg-gray-50 px-6 py-16">
      {icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-pill bg-gray-150 text-gray-500">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
        {title}
      </h3>
      {body && (
        <p className="text-base text-gray-500 max-w-sm [letter-spacing:var(--tv-track-tight)]">
          {body}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
