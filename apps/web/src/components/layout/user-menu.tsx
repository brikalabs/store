import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@brika/clay";
import { Link } from "@tanstack/react-router";
import { ChevronDown, LayoutGrid, LogOut, Settings, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { GradientAvatar } from "@/components/clay/plugin-icon";
import { ThemeSegment } from "@/components/layout/theme-segment";
import type { CurrentUser } from "@/hooks/use-current-user";
import { fetchIsOperator } from "@/server/require-operator";

const itemClass =
  "gap-2.5 rounded-lg px-2.5 py-2 font-medium text-[13.5px] [&_svg]:size-[18px] [&_svg]:text-muted-foreground";

/**
 * The signed-in user's account menu in the navbar: an avatar+name pill that opens
 * a dropdown with quick links, the theme control, and sign out. The operator
 * console entry only appears for registry operators (resolved server-side), so
 * the console's existence stays hidden from everyone else.
 */
export function UserMenu({ user }: Readonly<{ user: CurrentUser }>) {
  const name = user.name ?? "Your account";
  const firstName = name.split(" ")[0];
  const [operator, setOperator] = useState(false);
  useEffect(() => {
    fetchIsOperator()
      .then(setOperator)
      .catch(() => setOperator(false));
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group inline-flex h-[42px] items-center gap-2.5 rounded-full border border-input bg-card py-0 pr-2 pl-1.5 outline-none transition-colors hover:border-brand-border hover:shadow-sm">
        <GradientAvatar seed={user.id} label={name} imageUrl={user.avatarUrl} size={30} round />
        <span className="max-w-24 truncate font-semibold text-[13px] text-foreground">
          {firstName}
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-2xl p-1.5">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <GradientAvatar seed={user.id} label={name} imageUrl={user.avatarUrl} size={40} />
          <div className="min-w-0">
            <div className="truncate font-bold text-foreground text-sm">{name}</div>
            <div className="truncate text-muted-foreground text-xs">
              {user.email ?? "Developer"}
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/dashboard">
            <LayoutGrid />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/dashboard/account/tokens">
            <Settings />
            Account settings
          </Link>
        </DropdownMenuItem>
        {operator ? (
          <DropdownMenuItem
            asChild
            className="gap-2.5 rounded-lg px-2.5 py-2 font-semibold text-[13.5px] text-warning focus:bg-warning-tint focus:text-warning [&_svg]:size-[18px]"
          >
            <Link to="/operator/scopes">
              <Shield />
              Operator console
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuSeparator />

        <div className="px-2 py-1.5">
          <span className="mb-2 block font-medium text-[13.5px] text-foreground">Theme</span>
          <ThemeSegment />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          asChild
          className="gap-2.5 rounded-lg px-2.5 py-2 font-semibold text-[13.5px] text-danger focus:bg-danger-tint focus:text-danger [&_svg]:size-[18px]"
        >
          <a href="/auth/logout">
            <LogOut />
            Sign out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
