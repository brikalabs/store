# Icon Studio

Generate crisp square plugin icons from 200k+ glyphs, gradients, and monograms,
right inside your Brika hub. Powered by
[`@brika/icon-studio`](https://www.npmjs.com/package/@brika/icon-studio).

## Tools

- **generate-icon** - render a square SVG icon from a glyph, gradient, and
  optional monogram.
- **search-glyphs** - search 200k+ glyphs from Lucide, Simple Icons, and
  Iconify.

## Blocks

- **Icon from text** - a transform block that turns a name or short prompt into
  an icon.

## Bricks

- **Icon preview** - a board brick that previews a generated icon.

## Permissions

Icon Studio fetches glyph sets from `api.iconify.design` and the Simple Icons
CDN, reads bundled presets from `/bundle`, and caches rendered glyphs under
`/data/cache`. It never reads your secrets.
