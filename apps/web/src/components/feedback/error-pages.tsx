import { ExternalLink, Home, RotateCw, Search, Zap } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { useT } from "@/i18n";

/** 404: nothing matched the route, or the plugin doesn't exist. */
export function NotFoundPage() {
  const t = useT();
  return (
    <ErrorState
      codeLabel="ERROR 404"
      title={t("feedback:notFoundTitle")}
      message={t("feedback:notFoundMessage")}
      primary={{ label: t("feedback:backToStore"), icon: Home, to: "/" }}
      secondary={{ label: t("feedback:searchPlugins"), icon: Search, to: "/plugins" }}
      mono="// no route matched"
    />
  );
}

/** 500: an unhandled exception bubbled up to the route boundary. */
export function ServerErrorPage({ onRetry }: Readonly<{ onRetry?: () => void }>) {
  const t = useT();
  return (
    <ErrorState
      codeLabel="ERROR 500"
      title={t("feedback:serverErrorTitle")}
      message={t("feedback:serverErrorMessage")}
      icon={Zap}
      primary={{
        label: t("feedback:tryAgain"),
        icon: RotateCw,
        onClick: onRetry ?? (() => globalThis.location.reload()),
      }}
      secondary={{
        label: t("feedback:statusPage"),
        icon: ExternalLink,
        href: "https://status.brika.dev",
      }}
      mono="UncaughtSparkError: the hamsters stopped running"
    />
  );
}
