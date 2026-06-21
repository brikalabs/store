import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@brika/clay";
import { Check, ShieldCheck } from "lucide-react";
import type { SyntheticEvent } from "react";
import { GithubIcon } from "@/components/clay/icons";
import type { CurrentUser } from "@/hooks/use-current-user";
import { CODE_LENGTH, normalizeCode } from "@/lib/device-code";

// Each slot sits in its own single-slot group so it renders as a fully rounded,
// fully bordered box (the design's segmented look) instead of Clay's connected
// default, with the active box picking up the brand ring.
const SLOT_CLASS =
  "h-14 w-[42px] rounded-xl font-medium font-mono text-2xl text-foreground data-[active=true]:border-brand data-[active=true]:ring-brand/25";

function CodeSlot({ index }: Readonly<{ index: number }>) {
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
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}

/** The action area below the heading: loading skeleton, sign-in, success, or the OTP form. */
export function DeviceBody({
  loading,
  user,
  state,
  returnTo,
  value,
  submitting,
  onValueChange,
  onSubmit,
}: Readonly<DeviceBodyProps>) {
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
        <span>Signed in as</span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Avatar className="size-[18px]">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? "Your account"} />
            <AvatarFallback className="text-[8px]">
              {(user.name ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {user.name ?? "your account"}
        </span>
      </p>
    </form>
  );
}
