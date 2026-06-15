import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@brika/clay";
import { createFileRoute } from "@tanstack/react-router";
import { Check, KeyRound, ShieldCheck } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { GithubIcon } from "../components/clay/icons";
import { type CurrentUser, useCurrentUser } from "../lib/use-current-user";

const deviceSearch = z.object({ code: z.string().optional() });

// Device codes are two groups of 4 from an ambiguity-free alphabet (see the
// registry). The OTP holds the 8 characters without the separating hyphen,
// which we strip on the way in and re-add when approving.
const CODE_LENGTH = 8;
const NON_CODE_CHARS = /[^BCDFGHJKLMNPQRSTVWXZ23456789]/g;

export const Route = createFileRoute("/device")({
  validateSearch: (input) => deviceSearch.parse(input),
  component: DevicePage,
});

/** Drop the separator and anything outside the code alphabet. */
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(NON_CODE_CHARS, "").slice(0, CODE_LENGTH);
}

/** Re-insert the hyphen the registry stores: `BR7KMNPQ` -> `BR7K-MNPQ`. */
function withSeparator(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

/** True only on a local dev origin; auto-approval is gated to these. */
function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname } = window.location;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
}

// Each slot sits in its own single-slot group so it renders as a fully rounded,
// fully bordered box (the design's segmented look) instead of Clay's connected
// default, with the active box picking up the brand ring.
const SLOT_CLASS =
  "h-14 w-[42px] rounded-xl font-medium font-mono text-2xl text-foreground data-[active=true]:border-brand data-[active=true]:ring-brand/25";

function CodeSlot({ index }: { index: number }) {
  return (
    <InputOTPGroup>
      <InputOTPSlot index={index} className={SLOT_CLASS} />
    </InputOTPGroup>
  );
}

interface DeviceBodyProps {
  loading: boolean;
  user: CurrentUser | null;
  state: "idle" | "ok" | "error";
  returnTo: string;
  value: string;
  submitting: boolean;
  onValueChange: (next: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

/** The action area below the heading: loading skeleton, sign-in, success, or the OTP form. */
function DeviceBody({
  loading,
  user,
  state,
  returnTo,
  value,
  submitting,
  onValueChange,
  onSubmit,
}: DeviceBodyProps) {
  if (loading) {
    return <div className="h-[50px] w-full animate-pulse rounded-xl bg-muted" />;
  }

  if (user === null) {
    return (
      <a
        href={`/auth/github?return=${encodeURIComponent(returnTo)}`}
        className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-foreground font-semibold text-background transition-opacity hover:opacity-90"
      >
        <GithubIcon className="size-5" />
        Sign in with GitHub to continue
      </a>
    );
  }

  if (state === "ok") {
    return (
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-card px-5 py-7">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand-ink">
          <Check className="size-5" />
        </span>
        <p className="font-medium font-heading">Device authorized</p>
        <p className="text-muted-foreground text-sm">You can return to your terminal.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col items-center gap-[22px]">
      <InputOTP
        maxLength={CODE_LENGTH}
        value={value}
        onChange={(next) => onValueChange(normalizeCode(next))}
        pasteTransformer={normalizeCode}
        containerClassName="justify-center gap-[7px]"
      >
        <CodeSlot index={0} />
        <CodeSlot index={1} />
        <CodeSlot index={2} />
        <CodeSlot index={3} />
        <InputOTPSeparator className="text-muted-foreground/40" />
        <CodeSlot index={4} />
        <CodeSlot index={5} />
        <CodeSlot index={6} />
        <CodeSlot index={7} />
      </InputOTP>

      {state === "error" ? (
        <p className="-mt-3 text-destructive text-sm">
          That code is invalid, expired, or already used.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || value.length < CODE_LENGTH}
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-[15px] text-brand-foreground shadow-[0_8px_20px_-8px_rgba(242,84,45,0.5)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check className="size-4" />
        {submitting ? "Authorizing…" : "Authorize device"}
      </button>

      <div className="flex w-full items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-left text-[12.5px] text-foreground leading-relaxed">
        <ShieldCheck className="mt-px size-[18px] shrink-0 text-brand-ink" />
        <p>
          Only approve if you just ran{" "}
          <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11.5px]">
            brika login
          </code>{" "}
          on this device.
          <br />
          <span className="text-muted-foreground">
            This code expires in 10 minutes. Never share it with anyone.
          </span>
        </p>
      </div>

      <p className="flex items-center gap-2 text-muted-foreground text-[13px]">
        Signed in as
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Avatar className="size-[18px]">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.login} />
            <AvatarFallback className="text-[8px]">
              {user.login.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {user.login}
        </span>
      </p>
    </form>
  );
}

function DevicePage() {
  const { code } = Route.useSearch();
  const { user, loading } = useCurrentUser();
  const [value, setValue] = useState(() => normalizeCode(code ?? ""));
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const autoApproved = useRef(false);

  const submitApprove = useCallback(async (userCode: string) => {
    setSubmitting(true);
    setState("idle");
    const res = await fetch("/api/device/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_code: withSeparator(userCode) }),
    });
    setSubmitting(false);
    setState(res.ok ? "ok" : "error");
  }, []);

  // Local-dev convenience only: when you arrive already signed in with the code
  // pre-filled from the URL, approve automatically. Gated to localhost on
  // purpose - auto-approving in production would let an attacker get their own
  // device code approved by luring a signed-in user to /device?code=..., so the
  // deployed flow always keeps the explicit "Authorize" click below.
  useEffect(() => {
    if (autoApproved.current || loading || user === null) return;
    const normalized = normalizeCode(code ?? "");
    if (normalized.length < CODE_LENGTH || !isLocalHost()) return;
    autoApproved.current = true;
    void submitApprove(normalized);
  }, [loading, user, code, submitApprove]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitApprove(value);
  }

  const returnTo = code === undefined ? "/device" : `/device?code=${code}`;

  return (
    <main className="hero-surface flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-[430px] flex-col items-center gap-[22px] text-center">
        <span className="flex size-[54px] items-center justify-center rounded-2xl bg-gradient-to-br from-brand-muted to-brand text-white shadow-[0_10px_22px_-8px_rgba(242,84,45,0.55)]">
          <KeyRound className="size-6" />
        </span>

        <div className="flex flex-col gap-2.5">
          <h1 className="font-bold font-heading text-[27px] tracking-tight">
            Authorize the Brika CLI
          </h1>
          <p className="mx-auto max-w-[360px] text-[15px] text-muted-foreground leading-relaxed">
            Confirm the code shown in your terminal to let the CLI publish on your behalf.
          </p>
        </div>

        <DeviceBody
          loading={loading}
          user={user}
          state={state}
          returnTo={returnTo}
          value={value}
          submitting={submitting}
          onValueChange={setValue}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
