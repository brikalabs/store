import { useEffect, useState } from "react";
import { cleanLinks, type EditLink, type ProfileLink, useLinks } from "@/hooks/use-links";
import { readError, scopePath } from "@/lib/scope-api";

/** The scope's profile as the editor renders it: a free-text description and editable link rows. */
export interface ScopeProfile {
  description: string;
  setDescription: (value: string) => void;
  links: EditLink[];
  addLink: () => void;
  updateLink: (id: string, patch: Partial<ProfileLink>) => void;
  removeLink: (id: string) => void;
  saved: boolean;
  busy: boolean;
  save: () => Promise<void>;
}

/**
 * The editable profile for a scope: hydrate the description + links from the public record, edit them
 * locally, and PUT the cleaned payload. Editing clears the `saved` flag (so the button label reflects
 * unsaved work); `save` reports a failure through `onError` and re-seeds the rows from what it sent.
 */
export function useScopeProfile(scope: string, onError: (message: string) => void): ScopeProfile {
  const [description, setDescription] = useState("");
  const { links, add, update, remove, reset } = useLinks();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(scopePath(scope)).catch(() => null);
      if (!res?.ok) return;
      const data: { description?: string | null; links?: ProfileLink[] } = await res.json();
      setDescription(data.description ?? "");
      reset(data.links ?? []);
    })();
  }, [scope, reset]);

  // Any edit means the persisted "Saved" state is stale, so clear the flag on every mutation.
  const changeDescription = (value: string) => {
    setDescription(value);
    setSaved(false);
  };
  const updateLink = (id: string, patch: Partial<ProfileLink>) => {
    update(id, patch);
    setSaved(false);
  };
  const removeLink = (id: string) => {
    remove(id);
    setSaved(false);
  };

  async function save() {
    setBusy(true);
    setSaved(false);
    const cleaned = cleanLinks(links);
    const trimmed = description.trim();
    const res = await fetch(scopePath(scope, "/profile"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: trimmed.length === 0 ? null : trimmed, links: cleaned }),
    });
    setBusy(false);
    if (res.ok) {
      reset(cleaned);
      setSaved(true);
    } else {
      onError(await readError(res));
    }
  }

  return {
    description,
    setDescription: changeDescription,
    links,
    addLink: add,
    updateLink,
    removeLink,
    saved,
    busy,
    save,
  };
}
