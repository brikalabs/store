import { useCallback, useState } from "react";

/** A toggleable set selection of string ids, with a one-shot `clear` and a bulk `replace`. */
export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, toggle, clear, replace: setSelected };
}
