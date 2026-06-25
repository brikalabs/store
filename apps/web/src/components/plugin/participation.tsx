import { Button } from "@brika/clay";
import type { ReactNode } from "react";

/** The dashed "sign in with GitHub to participate" card shown to signed-out visitors. */
export function SignInToParticipate({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <a
      href="/auth/github"
      className="rounded-2xl border border-border border-dashed p-4 text-center text-muted-foreground text-sm hover:text-foreground"
    >
      {children}
    </a>
  );
}

/** The error line + right-aligned submit button shared by the comment and review forms. */
export function SubmitRow({
  error,
  submitting,
  busyLabel,
  submitLabel,
}: Readonly<{
  error: string | null;
  submitting: boolean;
  busyLabel: string;
  submitLabel: string;
}>) {
  return (
    <>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? busyLabel : submitLabel}
        </Button>
      </div>
    </>
  );
}
