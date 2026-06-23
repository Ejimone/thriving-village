"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FileUpload } from "@/components/ui/FileUpload";
import { toast } from "@/components/ui/Toaster";

export type SubmitResult = { error?: string; success?: boolean };

type Props = {
  /** Button label, e.g. "Apply for this role". */
  label: string;
  /** Dialog title. */
  title: string;
  /** Short line under the title. */
  subtitle?: string;
  /** Whether to show the note/prompt textarea at all. */
  withPrompt?: boolean;
  /** What the textarea is asking for. */
  promptLabel?: string;
  /** Field name the textarea submits as — matches the target endpoint's body shape. */
  promptName?: "message" | "description";
  /** Whether the prompt is required (contest entries require a description; applications/enrollment don't). */
  promptRequired?: boolean;
  /** Whether to show a file upload (CVs, submissions). */
  withFile?: boolean;
  fileHint?: string;
  /** Whether to show a portfolio URL field — lets applicants link work instead of (or alongside) a file. */
  withPortfolioUrl?: boolean;
  /** Toast message on submit. */
  successMessage: string;
  buttonVariant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  fullWidth?: boolean;
  /** Bound Server Action — e.g. `applyToJobAction.bind(null, job.id)`. */
  action: (formData: FormData) => Promise<SubmitResult>;
};

export function ApplyDialog({
  label,
  title,
  subtitle,
  withPrompt = true,
  promptLabel = "A short note (optional)",
  promptName = "message",
  promptRequired = false,
  withFile = false,
  fileHint,
  withPortfolioUrl = false,
  successMessage,
  buttonVariant = "inverse",
  size = "lg",
  fullWidth,
  action,
}: Props) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  const [state, formAction, pending] = useActionState<SubmitResult, FormData>(
    async (_prev, formData) => action(formData),
    {},
  );

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      toast.success(successMessage);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
            <Button variant="outline" size="sm" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="inverse" size="sm" type="submit" form={formId} disabled={pending}>
              {pending ? "Submitting…" : "Submit"}
            </Button>
          </>
        }
      >
        <form id={formId} action={formAction} className="flex flex-col gap-4">
          {subtitle && (
            <p className="-mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
              {subtitle}
            </p>
          )}
          <Input name="name" label="Full name" placeholder="Your name" required />
          <Input name="whatsapp" label="WhatsApp number" placeholder="+234 ..." required />
          {withPrompt && (
            <Textarea
              name={promptName}
              label={promptLabel}
              rows={4}
              placeholder="Tell us a little…"
              required={promptRequired}
            />
          )}
          {withFile && <FileUpload name="file" label="Attachment" hint={fileHint} />}
          {withPortfolioUrl && (
            <Input
              name="portfolioUrl"
              type="url"
              label="Portfolio URL (optional)"
              placeholder="https://your-portfolio.com"
              hint="Share a link instead of, or alongside, a file."
            />
          )}
        </form>
      </Modal>
    </>
  );
}
