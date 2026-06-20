import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { NotFoundPage, ServerErrorPage } from "@/components/feedback/error-pages";
import { SearchProvider } from "@/components/layout/search-context";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { themeBootScript } from "@/hooks/use-theme";
import appCss from "@/styles.css?url";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

export const Route = createRootRoute({
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

function RootDocument() {
  // The footer belongs on the public browsing pages, not the admin/login app.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showFooter = !pathname.startsWith("/dashboard");

  return (
    <html lang="en">
      <head>
        {/* Apply the persisted theme before paint to avoid a flash. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny trusted boot script
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        <SearchProvider>
          <SiteHeader />
          <div className="flex-1">
            <Outlet />
          </div>
          {showFooter ? <SiteFooter /> : null}
        </SearchProvider>
        <Scripts />
      </body>
    </html>
  );
}
