import { BrikaLogo } from "@brika/clay";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import { GithubIcon } from "@/components/clay/icons";
import { type AppKey, useT } from "@/i18n";

/** The sign-in providers, in order; each maps to a `/auth/<id>` social sign-in route. */
const PROVIDERS: ReadonlyArray<{
  id: string;
  labelKey: AppKey;
  Icon: ComponentType<{ className?: string }>;
}> = [{ id: "github", labelKey: "layout:loginContinueGithub", Icon: GithubIcon }];

const route = getRouteApi("/login");

/**
 * Developer sign-in screen listing the configured providers. The `return` search param (set by
 * `requireUser`) is carried through so the user lands back where they were after sign-in.
 */
export function LoginCard() {
  const t = useT();
  const { return: returnTo } = route.useSearch();
  const back = encodeURIComponent(returnTo ?? "/dashboard");

  return (
    <main className="hero-surface flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-[404px] flex-col items-center gap-5 rounded-[18px] border border-border bg-card p-9 shadow-[0_24px_50px_-24px_rgba(30,20,10,0.28)]">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <BrikaLogo className="h-11 w-auto" />
          <h1 className="mt-1.5 font-bold font-heading text-2xl tracking-tight">
            {t("layout:loginTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("layout:loginSubtitle")}</p>
        </div>

        {PROVIDERS.map(({ id, labelKey, Icon }) => (
          <a
            key={id}
            href={`/auth/${id}?return=${back}`}
            className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-foreground font-semibold text-background transition-opacity hover:opacity-90"
          >
            <Icon className="size-5" />
            {t(labelKey)}
          </a>
        ))}

        <div className="flex w-full items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-muted-foreground text-xs leading-relaxed">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-ink" />
          {t("layout:loginPrivacyNote")}
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex w-full flex-col items-center gap-3.5">
          <p className="text-center text-[11.5px] text-muted-foreground leading-relaxed">
            {t("layout:loginTermsNote")}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-semibold text-foreground text-sm transition-colors hover:text-brand-ink"
          >
            <ChevronLeft className="size-4" />
            {t("layout:loginBack")}
          </Link>
        </div>
      </div>
    </main>
  );
}
