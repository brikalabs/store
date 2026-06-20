---
id: HARDEN-005
title: "Tarball-origin pinning (no Host trust)"
status: done
area: harden
group: registry
test_mode: manual
traceability:
  code:
    - apps/registry/src/index.ts
  tests: []
---

## Description

Packument tarball URLs are built from the pinned `REGISTRY_URL` when configured,
otherwise from the request origin. Pinning means a client-supplied `Host` header can
never redirect installers to an attacker origin for the bytes.

## Acceptance criteria

### HARDEN-005-AC1 , Tarball URLs use the pinned origin, ignoring a spoofed Host
```gherkin
Given REGISTRY_URL is configured to the canonical registry origin
And a packument request arrives carrying an attacker-controlled Host header
When the packument is built
Then every dist.tarball URL uses the configured REGISTRY_URL origin
And no tarball URL reflects the request's Host header
```

### HARDEN-005-AC2 , Without a pin, tarball URLs fall back to the request origin
```gherkin
Given REGISTRY_URL is not configured
When the packument is built for a request to the registry origin
Then every dist.tarball URL uses that request's own origin
```
