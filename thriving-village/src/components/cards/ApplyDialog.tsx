"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FileUpload } from "@/components/ui/FileUpload";
import { toast } from "@/components/ui/Toaster";
import { isSignedInClientSide } from "@/lib/client-session";

export type SubmitResult = { error?: string; success?: boolean };

type Draft = { name: string; whatsapp: string; note: string; videoUrl: string; portfolioUrl: string };

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
  /** Whether to require a short intro video URL (e.g. a Loom link) before the attachment field. */
  withVideoUrl?: boolean;
  /** Toast message on submit. */
  successMessage: string;
  buttonVariant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  fullWidth?: boolean;
  /** Bound Server Action — e.g. `applyToJobAction.bind(null, job.id)`. */
  action: (formData: FormData) => Promise<SubmitResult>;
  /** Fired the instant submit happens, before the server confirms — lets a parent flip its own UI in lockstep. */
  onOptimisticSuccess?: () => void;
  /** Fired if the server call ultimately fails — lets a parent roll back what `onOptimisticSuccess` did. */
  onOptimisticError?: () => void;
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
  withVideoUrl = false,
  successMessage,
  buttonVariant = "inverse",
  size = "lg",
  fullWidth,
  action,
  onOptimisticSuccess,
  onOptimisticError,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const formId = useId();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setIsAuthenticated(isSignedInClientSide());
  }, []);

  function handleClick() {
    if (!isAuthenticated) {
      router.push(`/auth/signin?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setDraft({
      name: String(formData.get("name") ?? ""),
      whatsapp: String(formData.get("whatsapp") ?? ""),
      note: String(formData.get(promptName) ?? ""),
      videoUrl: String(formData.get("videoUrl") ?? ""),
      portfolioUrl: String(formData.get("portfolioUrl") ?? ""),
    });

    // Optimistic: assume success immediately, reconcile/roll back below.
    setOpen(false);
    toast.success(successMessage);
    onOptimisticSuccess?.();

    startTransition(async () => {
      const result = await action(formData);
      if (result.error) {
        setOpen(true); // roll back — modal reopens with `draft` restored below
        toast.error(result.error);
        onOptimisticError?.();
      }
    });
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        size={size}
        fullWidth={fullWidth}
        onClick={handleClick}
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
              Submit
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
          {subtitle && (
            <p className="-mt-2 text-[15px] text-gray-600 [letter-spacing:var(--tv-track-tight)]">
              {subtitle}
            </p>
          )}
          <Input name="name" label="Full name" placeholder="Your name" defaultValue={draft?.name} required />
          <Input name="whatsapp" label="WhatsApp number" placeholder="+234 ..." defaultValue={draft?.whatsapp} required />
          {withPrompt && (
            <Textarea
              name={promptName}
              label={promptLabel}
              rows={4}
              placeholder="Tell us a little…"
              defaultValue={draft?.note}
              required={promptRequired}
            />
          )}
          {withVideoUrl && (
            <Input
              name="videoUrl"
              type="url"
              label="Intro video URL (Loom)"
              placeholder="https://www.loom.com/share/..."
              defaultValue={draft?.videoUrl}
              hint="Record a short Loom video (under 5 minutes) introducing yourself, then paste the link here."
              required
            />
          )}
          {withFile && <FileUpload name="file" label="Attachment" hint={fileHint} />}
          {withPortfolioUrl && (
            <Input
              name="portfolioUrl"
              type="url"
              label="Portfolio URL"
              placeholder="https://your-portfolio.com"
              defaultValue={draft?.portfolioUrl}
              hint="Share a link instead of, or alongside, a file."
            />
          )}
        </form>
      </Modal>
    </>
  );
}
