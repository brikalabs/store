# Acceptable Use Policy

> **Draft, not yet in effect.** Pending legal review. See the
> [legal overview](/legal).

**Last updated:** 2026-06-15

This Acceptable Use Policy ("AUP") describes what may be published to the Brika
registry and how the Services may be used. It is part of the
[Terms of Service](/legal/terms). We enforce it to keep the ecosystem safe and
trustworthy.

## 1. Package contents and metadata

**Allowed**

- Brika plugin packages: JavaScript/TypeScript source and the assets a plugin
  needs (icon, screenshots, readme, changelog, localized metadata).
- Tooling and libraries that support building Brika plugins.
- Security and malware-analysis tooling, clearly labeled as such, that is not
  itself functional malware.

**Not allowed**

- Malware, adware, spyware, miners, or any code designed to harm, deceive, or
  gain unauthorized access to users, their devices, or their data.
- Packages that grossly misrepresent their purpose or functionality to deceive
  users or evade review.
- Using the registry as a CDN for production browser assets, or hosting media
  (images, video, audio, documents) unrelated to a plugin.
- Content that is illegal under applicable law, infringes intellectual property,
  or violates others' privacy.
- Secrets or credentials (API keys, tokens, private keys) committed into a
  package.

## 2. Scope and package names

- A scope should represent a real user, organization, or project you are
  associated with. Overly generic names may be declined.
- **No squatting.** Registering a scope or package name with no genuine intent to
  use it, or to block someone else, is prohibited. We investigate name disputes
  in good faith and may reassign names accordingly.
- **No selling names.** Scope and package names may not be registered in order to
  sell, lease, or transfer them for value. A reasonable, unconditional thank-you
  after a legitimate transfer is fine.
- **Trademarks and copyright.** We reserve the right to reclaim or reassign a
  name that infringes a trademark or other intellectual-property right.
- Reserved namespaces (such as `@brika`) are operated by us and cannot be
  claimed.

## 3. Use of the infrastructure

- Do not attempt to circumvent quotas, rate limits, or the publish gates.
- Do not attack, overload, probe, or attempt to gain unauthorized access to the
  Services, or interfere with other users.
- Do not scrape beyond reasonable, well-behaved use of the public APIs. Install
  traffic is edge-cached; respect cache headers and back off on `429`.

## 4. Security research and disclosure

Responsible security research is welcome. Report vulnerabilities privately to
**security@brika.dev** and give us a reasonable time to fix them before public
disclosure. Do not access or modify other users' data, and do not run
denial-of-service or destructive tests against the production Services.

## 5. Reporting and enforcement

- Report a package or behavior that violates this AUP via the report control on a
  package page, or by emailing **abuse@brika.dev**.
- When a package violates this AUP or poses a security risk, we may, with or
  without notice and at our discretion: `yank` or quarantine a version,
  `deprecate` a package, remove content for legal or security reasons, suspend a
  scope, or suspend an account.
- Because published versions are immutable, "removal" for legal or security
  takedowns is a deliberate, audited action distinct from a publisher's normal
  `yank`/`deprecate` controls.
- If you believe an enforcement action was a mistake, contact
  **abuse@brika.dev** to appeal.

## 6. Changes

We may update this AUP. Changes take effect when we update the "Last updated"
date above. Continued use after a change means you accept it.
