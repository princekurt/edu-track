"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingText,
  className,
}: {
  children: ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={cn("btn-primary", className)} disabled={pending}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  pendingText,
  className,
}: {
  children: ReactNode;
  confirmMessage: string;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cn("btn-danger", className)}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}
