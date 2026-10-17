# ShortMail — Design

Recorded 2026-10-17. The Airmail Envelope and monochrome editorial worlds
were explored and reverted (see git history on `ericmjl/beautiful-ui`); the
standing design is the plain P0 look, restored by Eric's call.

## World

Plain and quiet: white ground, ink text, Geist, default Tailwind utilities.
The interface recedes; the letter and the data are the design. Any future
visual world starts from here as evidence.

## Palette

- Ground: white `#ffffff`
- Text: `#111111` / grays from Tailwind's scale
- Accent: black on white (buttons invert on hover)
- No color commitments recorded

## Type

Geist Sans (app default, self-hosted via next/font) + Geist Mono for code.
No display face.

## Motion

None committed. Convex reactivity provides the live updates (queries
re-render as data changes; the widget preview refreshes via the
`shortmail-widget:change` event protocol in `src/widget/liveUpdates.ts`).

## Components

- Dashboard: two-column grid (config left, live widget preview right),
  stacked under 960px
- Send page: SSR shell mounting `<shortmail-widget>` (shadow DOM, themeable
  per owner via presets + sanitized custom CSS)
- Forms: standard Tailwind bordered inputs, black submit pills

## States

- Letters over 500 chars: counter turns red, submit disabled
- Sent: success panel
- Errors: named with recovery, surfaced via QueryBoundary retries
