import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useRef,
} from "react";

interface SearchApi {
  /** Ref attached to the header search input. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** Focus the header search input (used by ⌘K and in-page "search" CTAs). */
  focusSearch: () => void;
}

const SearchContext = createContext<SearchApi>({
  inputRef: { current: null },
  focusSearch: () => {},
});

export function useSearch(): SearchApi {
  return useContext(SearchContext);
}

/**
 * Wires the header search input to a global ⌘K shortcut. The input itself is a
 * normal text field (see HeaderSearch); ⌘K just focuses it.
 */
export function SearchProvider({ children }: { readonly children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function focusSearch() {
    inputRef.current?.focus();
  }

  return (
    <SearchContext.Provider value={{ inputRef, focusSearch }}>{children}</SearchContext.Provider>
  );
}
