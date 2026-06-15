import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { useCurrentUser } from "../lib/use-current-user";

const deviceSearch = z.object({ code: z.string().optional() });

export const Route = createFileRoute("/device")({
  validateSearch: (input) => deviceSearch.parse(input),
  component: DevicePage,
});

function DevicePage() {
  const { code } = Route.useSearch();
  const { user, loading } = useCurrentUser();
  const [value, setValue] = useState(code ?? "");
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);

  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setState("idle");
    const res = await fetch("/api/device/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_code: value.trim() }),
    });
    setSubmitting(false);
    setState(res.ok ? "ok" : "error");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold font-heading text-2xl tracking-tight">Authorize the Brika CLI</h1>
        <p className="text-muted-foreground text-sm">
          Confirm the code shown in your terminal to let the CLI publish on your behalf.
        </p>
      </div>

      {loading ? (
        <div className="h-12 w-full animate-pulse rounded-xl bg-muted" />
      ) : user === null ? (
        <a
          href="/auth/github"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-brand-foreground"
        >
          Sign in with GitHub to continue
        </a>
      ) : state === "ok" ? (
        <p className="rounded-xl border border-border bg-card px-5 py-4 font-medium">
          Device authorized. You can return to your terminal.
        </p>
      ) : (
        <form onSubmit={approve} className="flex w-full flex-col gap-3">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            autoComplete="off"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-mono text-lg tracking-[0.3em] uppercase outline-none focus:border-brand"
          />
          {state === "error" ? (
            <p className="text-destructive text-sm">
              That code is invalid, expired, or already used.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || value.trim().length === 0}
            className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-brand-foreground disabled:opacity-50"
          >
            {submitting ? "Authorizing…" : "Authorize device"}
          </button>
          <p className="text-muted-foreground text-xs">Signed in as {user.login}</p>
        </form>
      )}
    </main>
  );
}
