import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { runWeb } from "@/server/injector";

/**
 * Enter the app's DI injection context once per server request, so every route handler, loader,
 * `beforeLoad` and server function already runs inside it and just `inject(...)`s - no per-handler
 * `runWeb`. As a global request middleware it wraps all three server paths (SSR, server routes,
 * server functions), and the `AsyncLocalStorage` context propagates through `next()`'s whole chain.
 */
const injectionContext = createMiddleware({ type: "request" }).server(({ next }) => runWeb(next));

/**
 * Same-origin CSRF protection for server-function RPC. Providing `requestMiddleware` replaces the
 * framework's built-in default, so we re-add it here (the default behaviour) alongside our context.
 */
const csrf = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf, injectionContext],
}));
