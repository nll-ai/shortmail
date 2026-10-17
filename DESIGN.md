# ShortMail — Design

Recorded 2026-10-17 from the built Airmail Envelope world (impeccable run,
direction: "The Departure Board" roll → user-pinned skeuomorphic mail →
Airmail Envelope, code-led). Applies to the public surfaces of the new stack
(`app/`). The dashboard (Operate surface) keeps neutral Convex-reactive
chrome with these tokens as accents.

## World

The airmail letter: a warm laid-paper envelope on a morning desk, hatched
red/blue border, typewriter ink, a postmark that stamps when you send.
Calm, crisp, warm — respectful of attention on both sides.

## Palette

- Paper ground: `#f7f2e7` with faint ruled lines (28px rhythm)
- Ink: `#1a1613` (text, send button)
- Airmail red: `#b3402a` (stamp, postmark ink, accents, focus-underlines)
- Airmail blue: `#2a4b8d` (hatch border, PAR AVION mark, focus rings)
- Muted: `#6b6257` (meta text, 62% ink on paper — ≥4.5:1)

## Type

- Letter voice: **Courier Prime** (self-hosted via next/font, weights
  400/700), `--font-typewriter`
- UI/labels: Geist (app default) outside the letter surface
- Counter/meta: 0.7rem, muted

## Materials & motifs

- Airmail hatched border: 45° repeating red/blue/paper stripes, 14px frame
  (9px mobile), `border-image`
- Ruled lines: inputs sit on the paper's rules (no boxes); textarea carries
  its own 28px rules
- Perforated stamp: radial-gradient perforation over vermillion, rotated
  2.5°, denomination = "500 CHARACTERS"
- Round rubber postmark: double-ring, rotated −12°, `mix-blend-mode:
  multiply`, prints on send (SHORTMAIL POST + date)
- Ink signature moment: pressing SEND stamps the postmark (press keyframe:
  overshoot → settle, no glide), then the envelope departs

## Motion

One authored moment (the postmark press). Everything else: no glides on
state changes; opacity/color transitions ≤200ms.

## States

- Letters over 500 chars: counter turns red, submit disabled
- Submitting: button label "Stamping…", postmark visible
- Sent: stamped postmark + confirmation (optimistic UI; delivery failures
  land in Convex logs)
- Errors: named with recovery, red ink
- Focus: 2px dashed airmail-blue, offset 3px (every control)

## Browser surfaces

Selection: red ground, paper text. Caret: airmail red. Placeholders: 62%
ink (4.81:1 on paper).
