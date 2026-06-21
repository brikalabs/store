---
id: USER-004
title: "Account linking (link and unlink providers)"
status: done
area: user
group: user
test_mode: manual
traceability:
  code:
    - apps/web/src/routes/dashboard/accounts.tsx
    - apps/web/src/lib/auth/client.ts
    - apps/web/src/components/layout/admin-shell.tsx
    - apps/web/src/server/auth.ts:getAuth
  tests: []
---

## Description

The console exposes a "Connected accounts" section (`routes/dashboard/accounts.tsx`, linked from
`admin-shell.tsx`). It uses the browser BetterAuth client (`lib/auth/client.ts`) to `listAccounts()`
and render each provider's linked state, with a Link affordance (`linkSocial`) for unlinked
providers and an Unlink button (`unlinkAccount`) that is disabled for the last remaining provider.
The live OAuth link round-trip can't run headlessly, so this is verified manually; the surface
compiles and renders.

A signed-in user manages the provider identities linked to their account: they can link an
additional provider (e.g. add a second provider to a GitHub-only account) and unlink one they no
longer want, as long as at least one sign-in method remains. This is the console surface over the
BetterAuth linking semantics specified in `AUTH-011`.

## Acceptance criteria

### USER-004-AC1 , Linked providers are listed for the account
```gherkin
Given a signed-in user opens their account/linked-providers view
When the page loads
Then it lists every provider identity linked to their account
```

### USER-004-AC2 , Linking an additional provider attaches it to the account
```gherkin
Given a signed-in user starts the link flow for a provider not yet linked
When the provider flow completes successfully
Then that provider identity is linked to their account (AUTH-011)
And both identities subsequently resolve to the same account
```

### USER-004-AC3 , Unlinking a provider removes it
```gherkin
Given a signed-in user has more than one linked provider
When they unlink one provider
Then that provider identity is removed from their account
```

### USER-004-AC4 , The last sign-in method cannot be unlinked
```gherkin
Given a signed-in user has exactly one linked provider
When they attempt to unlink it
Then the unlink is refused so the account retains a sign-in method
```
