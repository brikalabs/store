import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchIsOperator } from "@/server/require-operator";

/**
 * A link into the operator console, rendered only for registry operators. Operator status
 * comes from a server function (the allowlist is server-only), so this resolves it after
 * mount and renders nothing for everyone else - the console's existence stays hidden.
 */
export function OperatorConsoleLink() {
  const [operator, setOperator] = useState(false);
  useEffect(() => {
    fetchIsOperator()
      .then(setOperator)
      .catch(() => setOperator(false));
  }, []);
  if (!operator) return null;
  return (
    <Link
      to="/operator/scopes"
      className="inline-flex w-fit items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-2.5 font-semibold text-foreground text-sm transition-colors hover:bg-amber-500/10"
    >
      <ShieldAlert className="size-4 text-amber-600" />
      Operator console
    </Link>
  );
}
