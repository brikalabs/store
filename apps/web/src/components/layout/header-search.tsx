import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Kbd,
  KbdGroup,
  useModifier,
} from "@brika/clay";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { GradientAvatar, PluginIcon } from "@/components/clay/plugin-icon";
import { useSearch } from "@/components/layout/search-context";
import { usePluginSearch } from "@/hooks/use-plugin-search";

/**
 * Header search: a live text field with a keyboard-navigable results dropdown (Clay's cmdk).
 * ⌘K focuses it; the first row is highlighted so a plain Enter goes to the full results page.
 */
export function HeaderSearch() {
  const { inputRef } = useSearch();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const { plugins, scopes } = usePluginSearch(value);

  // Platform shortcut glyph (⌘ on Apple, Ctrl elsewhere), resolved client-side by Clay.
  const { symbol } = useModifier();

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

  function go(action: () => void) {
    setOpen(false);
    inputRef.current?.blur();
    action();
  }

  function goSearch() {
    const next = value.trim();
    go(() => navigate({ to: "/plugins", search: next.length > 0 ? { q: next } : {} }));
  }

  const showResults = open && value.trim().length > 0;

  return (
    // shouldFilter is off because usePluginSearch already filtered server-side.
    <Command
      label="Search plugins and scopes"
      shouldFilter={false}
      loop
      className="relative hidden h-auto max-w-md flex-1 flex-col overflow-visible rounded-xl border border-border bg-muted/50 shadow-none backdrop-blur-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 sm:flex [&_[data-slot=command-input-wrapper]]:border-b-0 [&_[data-slot=command-input-wrapper]]:px-3 [&_[data-slot=command-input-wrapper]_svg]:text-muted-foreground [&_[data-slot=command-input-wrapper]_svg]:opacity-100"
    >
      <CommandInput
        ref={inputRef}
        value={value}
        onValueChange={(next) => {
          setValue(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
            return;
          }
          // Enter pressed before cmdk has selected a row (same frame as typing):
          // fall back to the search page; otherwise cmdk opens the highlighted result.
          if (event.key === "Enter") {
            const root = event.currentTarget.closest("[data-slot=command]");
            if (!root?.querySelector('[aria-selected="true"]')) goSearch();
          }
        }}
        placeholder="Search plugins and scopes…"
        className="pr-16"
      />
      <KbdGroup className="-translate-y-1/2 absolute top-1/2 right-3 z-10">
        <Kbd>{symbol}</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>

      {showResults ? (
        <CommandList className="absolute top-full left-0 z-50 mt-2 max-h-[60vh] w-full rounded-xl border border-border bg-popover p-1.5 shadow-2xl">
          <CommandItem
            value={`search:${value}`}
            onSelect={goSearch}
            className="gap-2.5 px-2 py-2 text-muted-foreground"
          >
            <Search className="size-4" />
            <span className="truncate text-foreground">Search for “{value.trim()}”</span>
          </CommandItem>

          {plugins.length > 0 ? (
            <CommandGroup heading="Plugins">
              {plugins.slice(0, 6).map((plugin) => (
                <CommandItem
                  key={plugin.name}
                  value={`plugin:${plugin.name}`}
                  onSelect={() => go(() => navigate({ to: "/$", params: { _splat: plugin.name } }))}
                  className="gap-2.5 px-2 py-2"
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
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {scopes.length > 0 ? (
            <CommandGroup heading="Scopes">
              {scopes.map((scope) => (
                <CommandItem
                  key={scope.scope}
                  value={`scope:${scope.scope}`}
                  onSelect={() => go(() => navigate({ to: "/$", params: { _splat: scope.scope } }))}
                  className="gap-2.5 px-2 py-2"
                >
                  <GradientAvatar
                    seed={scope.scope}
                    label={scope.name}
                    imageUrl={`/api/scopes/${encodeURIComponent(scope.scope)}/icon`}
                    size={22}
                  />
                  <span className="font-medium">{scope.name}</span>
                  <span className="ml-auto truncate font-mono text-muted-foreground text-xs">
                    {scope.scope}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      ) : null}
    </Command>
  );
}
