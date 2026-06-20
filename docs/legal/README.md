# Legal and policies

The policies that govern use of **store.brika.dev** and **registry.brika.dev**.
They are rendered as live pages in the store; the canonical source is the
markdown in [`apps/web/src/content/legal/`](../../apps/web/src/content/legal).

| Policy | Live page | Source |
| --- | --- | --- |
| Terms of Service | `/legal/terms` | [`terms.md`](../../apps/web/src/content/legal/terms.md) |
| Acceptable Use Policy | `/legal/acceptable-use` | [`acceptable-use.md`](../../apps/web/src/content/legal/acceptable-use.md) |
| Privacy Policy | `/legal/privacy` | [`privacy.md`](../../apps/web/src/content/legal/privacy.md) |
| Content and licensing | `/legal/licenses` | [`licenses.md`](../../apps/web/src/content/legal/licenses.md) |
| Cookie settings | `/legal/cookies` | [`cookies.md`](../../apps/web/src/content/legal/cookies.md) |

The pages share one layout (`apps/web/src/components/legal-page.tsx`): a LEGAL
eyebrow, the document title, a tab bar, and a sticky table of contents parsed
from the markdown headings. Related operational policy:
[Quotas and limits](../quotas-and-limits.md).

> **Draft, not yet in effect.** These are working documents adapted from common
> registry policy (npm and others) to Brika's architecture. They have **not** been
> reviewed by a lawyer and are not a binding agreement until published with a
> stated effective date. Before going live, confirm:
>
> - **Operating entity** and its registered address (used here as "Brika Labs").
> - **Governing law and venue** (the Terms reference the operator's jurisdiction).
> - **Contact addresses** (`legal@`, `privacy@`, `abuse@`, `security@`,
>   `quotas@`, `support@brika.dev`) are reserved and routed.
> - Whether a separate **Data Processing Addendum** and **cookie banner** are
>   required for your audience (EU/UK).

Last updated: 2026-06-15.
