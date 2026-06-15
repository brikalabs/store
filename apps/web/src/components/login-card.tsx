import { BrikaLogo } from "@brika/clay";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { GithubIcon } from "./clay/icons";

/**
 * Developer sign-in screen: a centered card on the warm ember wash. GitHub is
 * the only identity provider (it verifies npm package ownership).
 */
export function LoginCard() {
  return (
    <main className="hero-surface flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-[404px] flex-col items-center gap-5 rounded-[18px] border border-border bg-card p-9 shadow-[0_24px_50px_-24px_rgba(30,20,10,0.28)]">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <BrikaLogo className="h-11 w-auto" />
          <h1 className="mt-1.5 font-bold font-heading text-2xl tracking-tight">
            Sign in to Brika Store
          </h1>
          <p className="text-muted-foreground text-sm">
            Publish, localize, and manage your plugins.
          </p>
        </div>

        <a
          href="/auth/github"
          className="flex h-[50px] w-full items-center justify-center gap-2.5 rounded-xl bg-foreground font-semibold text-background transition-opacity hover:opacity-90"
        >
          <GithubIcon className="size-5" />
          Continue with GitHub
        </a>

        <div className="flex w-full items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-muted-foreground text-xs leading-relaxed">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-ink" />
          We use GitHub only to verify you own the npm package. The store never touches your code.
        </div>

        <div className="h-px w-full bg-border" />

        <div className="flex w-full flex-col items-center gap-3.5">
          <p className="text-center text-[11.5px] text-muted-foreground leading-relaxed">
            By continuing you agree to the Terms of Service and Privacy Policy.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-semibold text-foreground text-sm transition-colors hover:text-brand-ink"
          >
            <ChevronLeft className="size-4" />
            Back to the store
          </Link>
        </div>
      </div>
    </main>
  );
}
