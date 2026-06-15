# i18n Toolkit

Translate, format, and localize content across 40+ languages, right inside your
Brika hub. The toolkit ships an offline message catalog for English, French,
German, and Spanish and can call a machine-translation backend when you provide
an API key.

## Tools

- **translate** — translate a phrase from one language to another.
- **detect-language** — guess the language of a piece of text.

## Blocks

- **Localize message** — a transform block that resolves a message key for the
  active locale, with graceful fallback to your default language.

## Preferences

| Preference       | Type     | Notes                                       |
| ---------------- | -------- | ------------------------------------------- |
| `defaultLocale`  | dropdown | Locale used when a translation is missing.  |
| `apiKey`         | password | Optional machine-translation backend key.   |

## Privacy

When no API key is set, all translation happens locally against the bundled
catalog and no text leaves your hub.
