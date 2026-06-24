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
import { useT } from "@/i18n";
import { CODE_LENGTH, normalizeCode } from "@/lib/device-code";

// Each slot is its own single-slot group: a fully rounded box, not Clay's connected default.
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
  const t = useT();

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
        {t("device:signInToContinue")}
      </a>
    );
  }

  if (state === "ok") {
    return (
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-card px-5 py-7">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand-ink">
          <Check className="size-5" />
        </span>
        <p className="font-medium font-heading">{t("device:authorizedTitle")}</p>
        <p className="text-muted-foreground text-sm">{t("device:authorizedBody")}</p>
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
        <p className="-mt-3 text-destructive text-sm">{t("device:codeError")}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || value.length < CODE_LENGTH}
        className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-[15px] text-brand-foreground shadow-[0_8px_20px_-8px_rgba(242,84,45,0.5)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Check className="size-4" />
        {submitting ? t("device:authorizing") : t("device:authorizeCta")}
      </button>

      <div className="flex w-full items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-left text-[12.5px] text-foreground leading-relaxed">
        <ShieldCheck className="mt-px size-[18px] shrink-0 text-brand-ink" />
        <p>
          {t("device:approveHintBefore")}{" "}
          <code className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11.5px]">
            brika login
          </code>{" "}
          {t("device:approveHintAfter")}
          <br />
          <span className="text-muted-foreground">{t("device:expiryWarning")}</span>
        </p>
      </div>

      <p className="flex items-center gap-2 text-muted-foreground text-[13px]">
        <span>{t("device:signedInAs")}</span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <Avatar className="size-[18px]">
            <AvatarImage
              src={user.avatarUrl ?? undefined}
              alt={user.name ?? t("device:yourAccount")}
            />
            <AvatarFallback className="text-[8px]">
              {(user.name ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {user.name ?? t("device:yourAccount")}
        </span>
      </p>
    </form>
  );
}
