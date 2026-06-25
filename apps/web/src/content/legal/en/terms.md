# Terms of Service

> **Draft, not yet in effect.** These terms are a working document pending legal
> review. See the [legal overview](/legal).

**Last updated:** 2026-06-15

These Terms of Service ("Terms") govern your access to and use of the Brika
plugin platform, including the marketplace at **store.brika.dev** and the package
registry at **registry.brika.dev** (together, the "Services"), operated by
**Brika Labs** ("Brika", "we", "us"). By using the Services, you agree to these
Terms. If you do not agree, do not use the Services.

## 1. Eligibility and accounts

You must be at least 13 years old (or the age of digital consent in your
country, if higher) and able to form a binding contract. You sign in with
GitHub OAuth; you are responsible for activity under your account and for keeping
your GitHub account secure. One person or organization per identity; do not
impersonate others.

## 2. The Services

- The **store** provides discovery, search, developer profiles, ratings,
  reviews, discussion, and a publisher console.
- The **registry** hosts the official `@brika` plugins and serves them over an
  npm-compatible install API. Community plugins may remain on npm; the store
  federates discovery across both.

The Services are provided for building and distributing Brika plugins. We may add,
change, or remove features at any time.

## 3. Acceptable use

Your use of the Services is subject to the
[Acceptable Use Policy](/legal/acceptable-use), which is incorporated into these
Terms. In short: publish genuine plugin code, do not ship malware or deceptive
packages, do not squat or sell names, and do not abuse the infrastructure.

## 4. Your content and packages

You retain ownership of the packages, metadata, reviews, comments, and other
content you submit. You grant Brika and end users the licenses described in
[Content and licensing](/legal/licenses), which you should read as part of these
Terms. You represent that you have the right to publish what you publish and that
its license permits distribution through the Services.

## 5. Publishing, immutability, and provenance

- A published `name@version` is **immutable**: we do not overwrite it, and you
  cannot rely on being able to delete it. You can `yank` a version (hidden from
  new installs, still served to existing lockfiles) or `deprecate` it.
- We record **provenance** for each publish (for example the GitHub repository,
  workflow, commit, and actor from a verified OIDC token) and may display it.
- Publishing is anchored on GitHub repository control. You may only publish a
  package under a scope you own and from a repository you control.
- Quotas and size limits apply, per our
  [quotas and limits](https://github.com/brikalabs/store/blob/main/docs/quotas-and-limits.md).

## 6. Third-party services

The Services rely on third parties including GitHub (authentication and identity),
Cloudflare (hosting, storage, and delivery), the npm registry (federated
community discovery), and jsDelivr (asset delivery). Your use of those services
is governed by their own terms, and we are not responsible for them.

## 7. Feedback

If you send us feedback or suggestions, you grant us a perpetual, irrevocable,
royalty-free license to use it without obligation to you.

## 8. Availability and changes

The Services are provided on a best-effort basis with no uptime guarantee. The
edge-cached, immutable install path is designed to stay available, but we may
suspend, limit, or discontinue any part of the Services, with or without notice.

## 9. Suspension and termination

We may suspend or terminate your access, and yank, quarantine, or remove content,
if you violate these Terms or the Acceptable Use Policy, or as required by law or
to protect users and the Services. You may stop using the Services at any time.
Sections that by their nature should survive termination (ownership, licenses you
granted, disclaimers, limitation of liability, indemnification, governing law)
survive.

## 10. Disclaimers

THE SERVICES AND ALL CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT
WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not warrant that packages
published by others are safe, correct, or fit for any purpose. You are
responsible for reviewing and verifying any package you install.

## 11. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, BRIKA WILL NOT BE LIABLE FOR ANY
INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST
PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICES. OUR TOTAL
LIABILITY FOR ANY CLAIM RELATING TO THE SERVICES WILL NOT EXCEED the greater of
the amount you paid us in the 12 months before the claim, or USD 100.

## 12. Indemnification

You will indemnify and hold harmless Brika from claims, damages, and expenses
(including reasonable legal fees) arising from content you publish or from your
violation of these Terms or applicable law.

## 13. Governing law and disputes

These Terms are governed by the laws of the operator's jurisdiction, without
regard to conflict-of-laws rules, and the competent courts there have exclusive
jurisdiction over disputes, except where mandatory consumer-protection law
provides otherwise. The exact jurisdiction and venue are confirmed before these
Terms take effect.

## 14. Changes to these Terms

We may update these Terms. Material changes will be reflected by updating the
"Last updated" date and, where appropriate, by notice through the Services.
Continued use after a change means you accept the updated Terms.

## 15. Contact

Questions about these Terms: **legal@brika.dev**.
