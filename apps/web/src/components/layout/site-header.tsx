import { BrikaLogo, Button } from "@brika/clay";
import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { HeaderSearch } from "@/components/layout/header-search";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { type CurrentUser, useCurrentUser } from "@/hooks/use-current-user";
import { useT } from "@/i18n";

function AuthArea({ loading, user }: Readonly<{ loading: boolean; user: CurrentUser | null }>) {
  const t = useT();
  if (loading) return <div className="size-[42px] rounded-full bg-muted" />;
  if (user) return <UserMenu user={user} />;
  return (
    <Button
      asChild
      className="h-[38px] gap-2 rounded-[10px] bg-brand px-4 font-semibold text-brand-foreground transition-[filter] hover:bg-brand hover:brightness-105"
    >
      <a href="/login">
        <LogIn className="size-4" />
        <span className="hidden sm:inline">{t("nav:signIn")}</span>
      </a>
    </Button>
  );
}

export function SiteHeader() {
  const t = useT();
  const { user, loading } = useCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-border border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[62px] max-w-7xl items-center gap-[18px] px-6">
        <div className="flex min-w-0 flex-1 items-center gap-[18px]">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <BrikaLogo className="h-[30px] w-auto" />
            <span className="font-bold font-heading text-[19px] tracking-tight">Store</span>
          </Link>

          <HeaderSearch />
        </div>

        <nav className="flex shrink-0 items-center gap-1.5">
          <LocaleToggle />
          <ThemeToggle />
          <Button
            asChild
            variant="ghost"
            className="hidden h-[38px] rounded-[10px] px-3 font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <Link to="/plugins">{t("nav:browse")}</Link>
          </Button>
          <div className="mx-1 hidden h-6 w-px bg-input sm:block" />
          <AuthArea loading={loading} user={user} />
        </nav>
      </div>
    </header>
  );
}
