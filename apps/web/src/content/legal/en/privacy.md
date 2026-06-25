# Privacy Policy

> **Draft, not yet in effect.** Pending legal review. See the
> [legal overview](/legal).

**Last updated:** 2026-06-15

This Privacy Policy explains what data the Brika platform (**store.brika.dev** and
**registry.brika.dev**), operated by **Brika Labs**, collects and how we handle
it. It is part of the [Terms of Service](/legal/terms).

## 1. Data we collect

- **Account data (from GitHub OAuth).** When you sign in, we receive your GitHub
  user id, username, display name, avatar URL, and the email address associated
  with your GitHub account. We do not receive your GitHub password.
- **Publisher and provenance data.** When you publish, we record the package
  metadata and provenance of the publish: for CI publishes via GitHub OIDC, the
  repository, workflow, commit, and actor; for local publishes, the authenticated
  user. This is part of the supply-chain record and may be shown publicly.
- **Public content you create.** Packages and their metadata, reviews, ratings,
  comments, and profile information are public by design.
- **Usage and aggregate metrics.** Download and install counts, which are
  aggregated and not used to track individuals.
- **Technical and security data.** Request logs, IP addresses, and user-agent
  strings, used for rate limiting, abuse prevention, debugging, and security.
- **Session cookie.** A single signed (HMAC) session cookie that keeps you logged
  in. We do not use third-party advertising or cross-site tracking cookies. See
  [Cookie settings](/legal/cookies).

## 2. How we use data

- To operate the Services: authenticate you, serve packages, run the publisher
  console, and display public registry and social content.
- To secure the Services: enforce quotas and the Acceptable Use Policy, prevent
  abuse, and investigate security incidents.
- To maintain supply-chain integrity: keep an immutable record of published
  versions and their provenance.
- To communicate with you about your account, security, or policy changes.

## 3. Legal bases (where GDPR or similar law applies)

- **Performance of a contract:** providing the Services you signed up for.
- **Legitimate interests:** securing the platform, preventing abuse, and keeping
  the registry's integrity record.
- **Consent:** where specifically requested (for example optional communications).
- **Legal obligation:** where we must retain or disclose data by law.

## 4. How data is shared

- **Service providers (processors).** Cloudflare provides hosting, storage (D1,
  R2, KV), and content delivery; jsDelivr serves public package assets. They
  process data on our behalf to run the Services.
- **GitHub.** Used for authentication and identity; the npm registry is queried
  for federated discovery of community packages.
- **Publicly.** Registry data, provenance, and the social content you post are
  public by the nature of a package registry.
- **Legal.** We may disclose data where required by law or to protect users, the
  public, or the Services.
- We do **not** sell your personal data.

## 5. International transfers

The Services run on Cloudflare's global edge network, so data may be processed in
countries other than yours. Where required, we rely on appropriate safeguards for
international transfers.

## 6. Retention

- **Account data** is kept while your account is active. If you close your
  account, we delete or anonymize your personal account data, subject to the
  exceptions below.
- **Public package data and provenance** may be retained even after account
  closure, because published versions are immutable and the integrity and
  provenance record is relied upon by everyone who installed those versions.
- **Technical logs** are kept for a limited period for security and debugging,
  then deleted or aggregated.

## 7. Your rights

Depending on where you live, you may have the right to access, correct, delete,
export, or object to the processing of your personal data. We will honor valid
requests, with one important limit: we generally cannot delete already-published
package versions or their provenance, because the ecosystem depends on their
immutability and integrity. To exercise a right, contact **privacy@brika.dev**.

## 8. Children

The Services are not directed to children under 13 (or the age of digital consent
in your country, if higher), and we do not knowingly collect their personal data.

## 9. Changes

We may update this Privacy Policy. Changes take effect when we update the "Last
updated" date above, with notice through the Services for material changes.

## 10. Contact

Privacy questions or requests: **privacy@brika.dev**.
