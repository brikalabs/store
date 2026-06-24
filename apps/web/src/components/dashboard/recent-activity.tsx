import { Card } from "@brika/clay";
import type { Translate } from "@brika/i18n";
import { Ban, Bookmark, Check, type LucideIcon, Settings2, TriangleAlert } from "lucide-react";
import type { ActivityEntry } from "@/hooks/use-activity";
import { type AppKey, useRelativeTime, useT } from "@/i18n";

/**
 * Activity rows are styled generically: the action is classified into a tone by keyword (so a new
 * audit action still renders sensibly), then labelled - a few common verbs read as past tense, and
 * anything else is humanized (`scope_domain_add` -> "Domain add"). No per-action table to maintain.
 */
type Tone = { icon: LucideIcon; accent: string };
const TONES: Record<"good" | "warn" | "bad" | "brand" | "neutral", Tone> = {
  good: { icon: Check, accent: "bg-success-tint text-success" },
  warn: { icon: TriangleAlert, accent: "bg-warning-tint text-warning" },
  bad: { icon: Ban, accent: "bg-danger-tint text-danger" },
  brand: { icon: Bookmark, accent: "bg-brand-tint text-brand-ink" },
  neutral: { icon: Settings2, accent: "bg-accent text-muted-foreground" },
};

function toneFor(action: string): Tone {
  if (/reject|fail|deprecat/.test(action)) return TONES.warn;
  if (/takedown|yank|delete|remove/.test(action)) return TONES.bad;
  if (/reserve/.test(action)) return TONES.brand;
  if (/publish|create|add|set|verif|restore|^un/.test(action)) return TONES.good;
  return TONES.neutral;
}

// Past-tense labels for the handful of common actions, as i18n keys in the `dashboard` namespace;
// everything else is humanized from the token (an unanticipated audit action reads sensibly).
const VERB_KEY = {
  publish: "verbPublish",
  publish_rejected: "verbPublishRejected",
  reserve: "verbReserve",
  deprecate: "verbDeprecate",
  yank: "verbYank",
  unyank: "verbUnyank",
  delete: "verbDelete",
  takedown: "verbTakedown",
  restore: "verbRestore",
} as const;

const VERB_KEYS = new Map<string, AppKey>(
  Object.entries(VERB_KEY).map(([action, key]) => [action, `dashboard:${key}`]),
);

function verbFor(action: string, t: Translate<AppKey>): string {
  const key = VERB_KEYS.get(action);
  if (key) return t(key);
  const words = action.replace(/^(scope|org)_/, "").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Side-rail feed of the developer's own recent audit events (publishes, yanks, scope changes). */
export function RecentActivity({ entries }: Readonly<{ entries: ActivityEntry[] }>) {
  const relative = useRelativeTime();
  const t = useT();
  return (
    <Card className="flex flex-col gap-3.5 rounded-[20px] p-5 shadow-sm">
      <div className="font-bold text-[11px] text-muted-foreground uppercase tracking-[0.07em]">
        {t("dashboard:recentActivity")}
      </div>
      {entries.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">{t("dashboard:activityEmpty")}</p>
      ) : (
        entries.map((entry) => {
          const { icon: Icon, accent } = toneFor(entry.action);
          return (
            <div key={entry.id} className="flex items-start gap-[11px]">
              <span
                className={`mt-px flex size-[26px] shrink-0 items-center justify-center rounded-lg ${accent}`}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                {/* Always the full @scope/name (or the scope itself for scope-level actions). */}
                <div className="truncate font-mono font-semibold text-[12.5px] text-foreground">
                  {entry.target ?? ""}
                  {entry.version ? ` v${entry.version}` : ""}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {verbFor(entry.action, t)} · {relative(entry.at)}
                </div>
              </div>
            </div>
          );
        })
      )}
    </Card>
  );
}
