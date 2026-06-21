"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ============================================================
   Lightweight toast system (sonner-style, brand-themed).
   Use: import { toast } from "@/components/ui/Toaster";
        toast.success("Application sent");
   The in-house team can swap this for sonner later if desired.
   ============================================================ */

type ToastType = "success" | "error" | "info";
type ToastItem = { id: number; type: ToastType; message: string };

let counter = 0;
const listeners = new Set<(items: ToastItem[]) => void>();
let items: ToastItem[] = [];

function emit() {
  listeners.forEach((l) => l([...items]));
}

function remove(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function push(type: ToastType, message: string) {
  const id = ++counter;
  items = [...items, { id, type, message }];
  emit();
  setTimeout(() => remove(id), 3800);
}

export const toast = {
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m),
  info: (m: string) => push("info", m),
};

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-success" />,
  error: <AlertCircle size={18} className="text-error" />,
  info: <Info size={18} className="text-gray-500" />,
};

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 w-[min(360px,calc(100vw-2.5rem))]">
      {list.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "flex items-center gap-3 bg-white border border-gray-200 rounded-sm shadow-lg px-4 py-3.5",
            "animate-[tv-toast-in_.18s_ease]",
          )}
        >
          {icons[t.type]}
          <span className="flex-1 text-sm font-medium text-black [letter-spacing:var(--tv-track-tight)]">
            {t.message}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => remove(t.id)}
            className="text-gray-400 hover:text-black"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <style>{`@keyframes tv-toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
