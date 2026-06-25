import { inject, token } from "@brika/di";
import { createTranslator, type Translate } from "@brika/i18n";
import { i18n } from "@/i18n/catalog";

/** The request's UI locale. Bound per request in `runWeb`'s child injector. */
export const RequestLocale = token<string>("RequestLocale");

/**
 * The per-request server translator, injectable anywhere on the backend via `inject(ServerT)`.
 *
 * Deliberately a CLASS, not a `token(name, factory)`: a default-factory token caches at the ROOT
 * injector (one per isolate), which would pin the first request's locale for every later request. An
 * unregistered class instead builds in the scope it is asked from, i.e. the per-request child where
 * {@link RequestLocale} is bound, so each request gets its own locale.
 */
export class ServerT {
  readonly #locale = inject(RequestLocale);
  /** Translate a `"namespace:key"`; bare keys resolve in the `errors` namespace (stable core codes). */
  readonly t: Translate = createTranslator(this.#locale, i18n.catalogFor(this.#locale), "errors");
  readonly locale = this.#locale;
}
