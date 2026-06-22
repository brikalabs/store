import { getRouteApi, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { SearchProvider } from "@/components/layout/search-context";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeContext, themeBootScript, useThemeController } from "@/hooks/use-theme";

const rootApi = getRouteApi("__root__");

/**
 * The HTML document shell. The cookie mode seeds SSR so `data-mode` matches the client for an explicit
 * light/dark choice; suppressHydrationWarning is scoped to the cases the server cannot resolve -
 * `system` mode and a first visit with no cookie, where the OS preference is client-only.
 */
export function RootDocument() {
  // The footer belongs on the public browsing pages, not the admin/login app.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showFooter = !pathname.startsWith("/dashboard");
  const initial = rootApi.useLoaderData();
  const { theme, api } = useThemeController(initial);

  return (
    <html
      lang="en"
      data-mode={theme}
      className={theme === "dark" ? "dark" : undefined}
      suppressHydrationWarning={initial === "system" || initial === null}
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: tiny trusted boot script
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased">
        <ThemeContext.Provider value={api}>
          <SearchProvider>
            <SiteHeader />
            <div className="flex-1">
              <Outlet />
            </div>
            {showFooter ? <SiteFooter /> : null}
          </SearchProvider>
        </ThemeContext.Provider>
        <Scripts />
      </body>
    </html>
  );
}
