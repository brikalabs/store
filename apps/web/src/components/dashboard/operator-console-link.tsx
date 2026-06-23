import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchIsOperator } from "@/server/require-operator";

/**
 * A link into the operator console, resolved server-side (the allowlist is server-only) and
 * rendered only for operators, so the console's existence stays hidden from everyone else.
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
      className="flex items-center gap-2.5 rounded-2xl border border-warning-border bg-warning-tint px-[17px] py-[15px] font-semibold text-[13.5px] text-foreground transition-shadow hover:shadow-sm"
    >
      <ShieldAlert className="size-[18px] text-warning" />
      Operator console
      <ArrowRight className="ml-auto size-4 text-warning" />
    </Link>
  );
}
