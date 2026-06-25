# Content and licensing

> **Draft, not yet in effect.** Pending legal review. See the
> [legal overview](/legal).

**Last updated:** 2026-06-15

This page explains who owns what, and the licenses involved when you publish to or
install from the Brika registry. It is part of the
[Terms of Service](/legal/terms).

## 1. The platform's own source

The Brika platform source code is licensed under the **MIT License** (see the
[LICENSE](https://github.com/brikalabs/store/blob/main/LICENSE) file). That
license covers our code, not the packages published to the registry.

## 2. You keep ownership of your packages

Publishing a package does **not** transfer ownership to Brika. You (or your
package's existing license holders) retain all rights. Each published package
carries its **own** license, declared in its `license` field and any `LICENSE`
file in the tarball. End users receive your package under that license, not under
ours.

You must declare a `license` for every published package. We strongly recommend
an OSI-approved open-source license; if your terms are custom or proprietary, the
declared license still governs how others may use the code.

## 3. The license you grant us and end users

So that the registry can actually function, when you publish a package you grant:

- **To Brika**, a non-exclusive, worldwide, royalty-free license to store, host,
  cache, reproduce, and distribute your package and its metadata (including via
  content-delivery networks such as jsDelivr), and to display its public metadata
  in the store, in order to operate the Services.
- **To end users**, the right to download and install your package through the
  Services. What they may then *do* with the code is governed by your package's
  own declared license, not by this grant.

This grant is limited to operating the Services. It does not let us relicense your
code, claim authorship, or use it beyond running the registry and store.

## 4. Metadata and store assets

Your icon, screenshots, title, description, readme, changelog, and localized
store metadata are part of your published content. You grant the same hosting and
display license for them, so the store can render your listing.

## 5. Your representations

By publishing, you confirm that:

- you have the right to publish the package and its metadata,
- the package's declared license permits its distribution through the Services,
  and
- the content does not infringe anyone's intellectual-property or other rights
  and complies with the [Acceptable Use Policy](/legal/acceptable-use).

## 6. Immutability and license changes

Published versions are **immutable**. A version stays available under the license
it was published with, because installers pin it by integrity and rely on it. If
you change your license, the new license applies to **new versions** you publish
from then on; it does not retroactively change versions already published.

## 7. Takedowns and infringement

If you believe content on the Services infringes your rights, or otherwise
violates the Acceptable Use Policy, report it to **abuse@brika.dev** with enough
detail to identify the content and the basis of your claim. We may yank,
quarantine, or remove content for legal or security reasons as described in the
[Acceptable Use Policy](/legal/acceptable-use).
