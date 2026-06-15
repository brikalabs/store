import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    // Keep "@" literal in URLs (e.g. /plugins/@brika/plugin-weather), JSR-style,
    // instead of percent-encoding it to %40.
    pathParamsAllowedCharacters: ["@"],
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
