import { Kbd, KbdGroup } from "@brika/clay";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { type SyntheticEvent, useEffect, useState } from "react";
import { usePluginSearch } from "../lib/use-plugin-search";
import { GradientAvatar, PluginIcon } from "./clay/plugin-icon";
import { useSearch } from "./search-context";

/**
 * The header search: a normal text input (type and press Enter to search), with
 * a live results dropdown for quick navigation. ⌘K focuses it. It mirrors the
 * active query when you're on the search page.
 */
export function HeaderSearch() {
  const { inputRef } = useSearch();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const { plugins, authors } = usePluginSearch(value);

  // Mirror the active query from the URL (e.g. /plugins?q=ai).
  const urlQuery = useRouterState({
    select: (state) =>
      state.location.pathname === "/plugins"
        ? ((state.location.search as { q?: string }).q ?? "")
        : "",
  });
  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const next = value.trim();
    setOpen(false);
    inputRef.current?.blur();
    navigate({ to: "/plugins", search: next.length > 0 ? { q: next } : {} });
  }

  function go(action: () => void) {
    setOpen(false);
    inputRef.current?.blur();
    action();
  }

  const showResults = open && value.trim().length > 0 && (plugins.length > 0 || authors.length > 0);

  return (
    <form onSubmit={submit} className="relative hidden max-w-md flex-1 sm:block">
      <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder="Search plugins and authors…"
        aria-label="Search plugins and authors"
        className="h-10 w-full rounded-xl border border-border bg-muted/50 pr-16 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/40 focus:bg-card"
      />
      <KbdGroup className="-translate-y-1/2 absolute top-1/2 right-3">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>

      {showResults ? (
        <div className="absolute top-full left-0 z-50 mt-2 max-h-[60vh] w-full overflow-auto rounded-xl border border-border bg-popover shadow-2xl">
          {plugins.length > 0 ? (
            <div className="p-1.5">
              <div className="px-2 py-1 font-semibold text-muted-foreground text-xs">Plugins</div>
              {plugins.slice(0, 6).map((plugin) => (
                <button
                  key={plugin.name}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(() => navigate({ to: "/plugins/$", params: { _splat: plugin.name } }));
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <PluginIcon
                    name={plugin.name}
                    iconUrl={plugin.iconUrl}
                    capabilities={plugin.capabilities}
                    size={22}
                  />
                  <span className="font-medium">{plugin.displayName ?? plugin.name}</span>
                  <span className="ml-auto truncate text-muted-foreground text-xs">
                    {plugin.name}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {authors.length > 0 ? (
            <div className="border-border border-t p-1.5">
              <div className="px-2 py-1 font-semibold text-muted-foreground text-xs">Authors</div>
              {authors.map((author) => (
                <button
                  key={author.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(() => navigate({ to: "/developers/$id", params: { id: author.id } }));
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <GradientAvatar seed={author.id} label={author.name} size={22} />
                  <span className="font-medium">{author.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
