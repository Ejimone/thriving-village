"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

/** Centered modal/dialog. Soft radius, neutral shadow, scrim backdrop. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-lg shadow-lg border border-gray-200 max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between gap-4 p-6 pb-0">
          {title && (
            <h2 className="text-2xl font-bold text-black [letter-spacing:var(--tv-track-tight)]">
              {title}
            </h2>
          )}
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto -mr-1 -mt-1"
          >
            <X size={18} />
          </IconButton>
        </div>
        <div className="p-6">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 px-6 pb-6 pt-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
