"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FileUpload } from "@/components/ui/FileUpload";
import { toast } from "@/components/ui/Toaster";

type Props = {
  /** Button label, e.g. "Apply for this role". */
  label: string;
  /** Dialog title. */
  title: string;
  /** Short line under the title. */
  subtitle?: string;
  /** What the textarea is asking for. */
  promptLabel?: string;
  /** Whether to show a file upload (CVs, submissions). */
  withFile?: boolean;
  fileHint?: string;
  /** Toast message on submit. */
  successMessage: string;
  buttonVariant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  fullWidth?: boolean;
};

/**
 * Placeholder apply / submit flow. No real submission happens —
 * the in-house team wires this up. We just collect input and toast.
 */
export function ApplyDialog({
  label,
  title,
  subtitle,
  promptLabel = "A short note (optional)",
  withFile = false,
  fileHint,
  successMessage,
  buttonVariant = "inverse",
  size = "lg",
  fullWidth,
}: Props) {
  const [open, setOpen] = useState(false);

  function submit() {
    setOpen(false);
    toast.success(successMessage);
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        size={size}
        fullWidth={fullWidth}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="inverse" size="sm" onClick={submit}>
              Submit
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {subtitle && (
            <p className="-mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
              {subtitle}
            </p>
          )}
          <Input label="Full name" placeholder="Your name" />
          <Input label="WhatsApp number" placeholder="+234 ..." />
          <Textarea label={promptLabel} rows={4} placeholder="Tell us a little…" />
          {withFile && (
            <FileUpload label="Attachment" hint={fileHint} />
          )}
        </div>
      </Modal>
    </>
  );
}
