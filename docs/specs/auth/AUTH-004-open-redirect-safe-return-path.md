---
id: AUTH-004
title: "Open-redirect-safe return path"
status: done
area: auth
group: auth
test_mode: unit
traceability:
  code:
    - apps/web/src/lib/auth-cookies.ts
  tests:
    - apps/web/src/lib/auth-cookies.test.ts
---

## Description

`safeReturnPath` is the single guard that keeps the OAuth `?return=` round-trip from becoming
an open redirect. Only a same-site path beginning with a single `/` is honoured; everything
else falls back to `/`. The cookie parser never throws on a garbled `Cookie` header.

## Acceptance criteria

### AUTH-004-AC1 , A same-site path is preserved
```gherkin
Given a return value of /dashboard/scopes
When it is passed through the safe-return guard
Then the result is /dashboard/scopes unchanged
```

### AUTH-004-AC2 , Absolute and protocol-relative URLs fall back to root
```gherkin
Given a return value of https://evil.example/phish or //evil.example
When it is passed through the safe-return guard
Then the result is /
```

### AUTH-004-AC3 , Missing or non-path input falls back to root
```gherkin
Given a return value that is null, undefined, or a string not starting with /
When it is passed through the safe-return guard
Then the result is /
```

### AUTH-004-AC4 , A malformed cookie header does not crash request handling
```gherkin
Given a Cookie header containing a percent-encoding that cannot be decoded
When the cookies are parsed
Then parsing does not throw
And the offending value is returned in its raw form
```
