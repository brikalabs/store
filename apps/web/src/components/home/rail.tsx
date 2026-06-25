import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/i18n";

export function Rail({
  title,
  icon,
  seeAll,
  children,
}: Readonly<{
  title: string;
  icon?: ReactNode;
  seeAll?: boolean;
  children: ReactNode;
}>) {
  const t = useT();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 font-bold font-heading text-2xl tracking-tight">
          {icon}
          {title}
        </h2>
        {seeAll ? (
          <Link
            to="/plugins"
            className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          >
            {t("home:seeAll")}
            <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}
