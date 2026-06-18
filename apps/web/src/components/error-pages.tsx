import { ExternalLink, Home, RotateCw, Search, Zap } from "lucide-react";
import { ErrorState } from "./error-state";

/** 404: nothing matched the route, or the plugin doesn't exist. */
export function NotFoundPage() {
  return (
    <ErrorState
      codeLabel="ERROR 404"
      title="This brick isn't in the wall."
      message="We dug through every plugin and couldn't find that page. It was either unpublished, mistyped, or never bricked into existence."
      primary={{ label: "Back to store", icon: Home, to: "/" }}
      secondary={{ label: "Search plugins", icon: Search, to: "/plugins" }}
      mono="// no route matched"
    />
  );
}

/** 500: an unhandled exception bubbled up to the route boundary. */
export function ServerErrorPage({ onRetry }: Readonly<{ onRetry?: () => void }>) {
  return (
    <ErrorState
      codeLabel="ERROR 500"
      title="A spark misfired."
      message="Something on our side threw an exception mid-render. The on-call brick-layer has been paged, give it a moment and try again."
      icon={Zap}
      primary={{
        label: "Try again",
        icon: RotateCw,
        onClick: onRetry ?? (() => globalThis.location.reload()),
      }}
      secondary={{ label: "Status page", icon: ExternalLink, href: "https://status.brika.dev" }}
      mono="UncaughtSparkError: the hamsters stopped running"
    />
  );
}
