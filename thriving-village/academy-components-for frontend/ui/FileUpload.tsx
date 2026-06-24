"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  hint?: string;
  accept?: string;
  /** Placeholder handler — no real upload happens in this skin. */
  onFileSelect?: (file: File | null) => void;
};

export function FileUpload({ label, hint, accept, onFileSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File | null) {
    setFileName(file?.name ?? null);
    onFileSelect?.(file);
  }

  return (
    <div className="flex flex-col gap-1.5 font-sans w-full">
      {label && (
        <span className="text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-sm border-[1.5px] border-dashed px-6 py-8 text-center cursor-pointer transition-colors duration-150",
          dragging ? "border-black bg-gray-50" : "border-gray-300 hover:border-gray-500",
        )}
      >
        {fileName ? (
          <>
            <FileCheck2 size={24} className="text-black" />
            <span className="text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
              {fileName}
            </span>
            <span className="text-[13px] text-gray-500">Click to replace</span>
          </>
        ) : (
          <>
            <UploadCloud size={24} className="text-gray-500" />
            <span className="text-sm font-semibold text-black [letter-spacing:var(--tv-track-tight)]">
              Click to upload or drag and drop
            </span>
            {hint && <span className="text-[13px] text-gray-500">{hint}</span>}
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
