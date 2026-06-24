import { useEffect, useState } from "react";

// The name segment: lowercase, starts alphanumeric, then a-z0-9-. Mirrors the registry's
// canonical-name rule (the scope prefix is added separately), so the client and server agree.
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
// npm caps the full `@scope/name` at 214 chars; the registry's isCanonicalName enforces the same.
export const MAX_NAME = 214;

/** Live name-check state. `ok` = valid + available, the only state that lets you create. */
export type NameCheck = "idle" | "checking" | "ok" | "taken" | "invalid";

/** True when `name` matches the canonical-name rule and `scope/name` fits within `MAX_NAME`. */
export function isNameValid(scope: string, name: string): boolean {
  return NAME_RE.test(name) && `${scope}/${name}`.length <= MAX_NAME;
}

/** Map an availability-probe response to a `NameCheck`. A null (failed) probe falls back to "ok". */
export function probeToCheck(d: { valid: boolean; available: boolean } | null): NameCheck {
  if (d === null) return "ok";
  if (!d.valid) return "invalid";
  return d.available ? "ok" : "taken";
}

/**
 * Live-check the name as it is typed: format first, then a debounced availability probe so the user
 * learns "Taken" before submitting (the POST still re-checks, so this is a hint not a gate).
 */
export function useNameCheck(scope: string | null, name: string): NameCheck {
  const [check, setCheck] = useState<NameCheck>("idle");
  useEffect(() => {
    if (name === "" || scope === null) {
      setCheck("idle");
      return;
    }
    if (!isNameValid(scope, name)) {
      setCheck("invalid");
      return;
    }
    setCheck("checking");
    let active = true;
    const timer = setTimeout(() => {
      const q = `scope=${encodeURIComponent(scope)}&name=${encodeURIComponent(name)}`;
      fetch(`/api/plugins/create?${q}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ valid: boolean; available: boolean }>) : null))
        .then((d) => active && setCheck(probeToCheck(d)))
        .catch(() => active && setCheck("ok"));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [scope, name]);
  return check;
}
