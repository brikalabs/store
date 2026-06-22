import { createRootRoute } from "@tanstack/react-router";
import { NotFoundPage, ServerErrorPage } from "@/components/feedback/error-pages";
import { RootDocument } from "@/components/layout/root-document";
import { fetchThemeMode } from "@/server/theme";
import appCss from "@/styles.css?url";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

export const Route = createRootRoute({
  // Read the theme-mode cookie at SSR so the document root renders the matching data-mode (no mismatch).
  loader: () => fetchThemeMode(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Brika Store" },
      {
        name: "description",
        content:
          "Discover, review, and install Brika plugins. A curated registry of verified, scoped plugins.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      { rel: "stylesheet", href: FONTS_HREF },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ reset }) => <ServerErrorPage onRetry={reset} />,
});
