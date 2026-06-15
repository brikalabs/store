import { Avatar, AvatarFallback, AvatarImage, BrikaLogo } from "@brika/clay";
import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useCurrentUser } from "../lib/use-current-user";
import { HeaderSearch } from "./header-search";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const { user, loading } = useCurrentUser();

  return (
    <header className="sticky top-0 z-30 border-border border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-6">
        <div className="flex flex-1 items-center gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <BrikaLogo className="h-6 w-auto" />
            <span className="font-bold font-heading text-lg tracking-tight">Store</span>
          </Link>

          <HeaderSearch />
        </div>

        <nav className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
          <ThemeToggle />
          <Link
            to="/plugins"
            className="font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse
          </Link>
          {loading ? (
            <div className="size-9 rounded-full bg-muted" />
          ) : user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="hidden font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
              >
                Dashboard
              </Link>
              <Avatar className="size-8">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.login} /> : null}
                <AvatarFallback>{user.login.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <a
                href="/auth/logout"
                className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
              >
                Sign out
              </a>
            </div>
          ) : (
            <a
              href="/auth/github"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground text-sm transition-opacity hover:opacity-90"
            >
              <LogIn className="size-4" />
              <span className="hidden sm:inline">Sign in</span>
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
