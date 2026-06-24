import { getRouteApi } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { type SyntheticEvent, useState } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDeviceApproval } from "@/hooks/use-device-approval";
import { useT } from "@/i18n";
import { normalizeCode } from "@/lib/device-code";
import { DeviceBody } from "./device-body";

const route = getRouteApi("/device");

export function DevicePage() {
  const { code } = route.useSearch();
  const { user, loading } = useCurrentUser();
  const { state, submitting, approve } = useDeviceApproval();
  const [value, setValue] = useState(() => normalizeCode(code ?? ""));
  const t = useT();

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    void approve(value);
  }

  const returnTo = code === undefined ? "/device" : `/device?code=${code}`;

  return (
    <main className="hero-surface flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-[430px] flex-col items-center gap-[22px] text-center">
        <span className="flex size-[54px] items-center justify-center rounded-2xl bg-gradient-to-br from-brand-muted to-brand text-white shadow-[0_10px_22px_-8px_rgba(242,84,45,0.55)]">
          <KeyRound className="size-6" />
        </span>

        <div className="flex flex-col gap-2.5">
          <h1 className="font-bold font-heading text-[27px] tracking-tight">{t("device:title")}</h1>
          <p className="mx-auto max-w-[360px] text-[15px] text-muted-foreground leading-relaxed">
            {t("device:subtitle")}
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
