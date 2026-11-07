# Accessibility

BrightTrail has to work for a 6-year-old who can't read yet. Treat these rules as product requirements, not polish.

## Audio first

- Text-to-speech reads every card, question and answer choice aloud.
- A `ReplayButton` sits top-left on every kid screen. Its `label` is the exact line it replays.
- Reading mode turns narration off. Narration then shows as 24pt `kid-ink` text on the story card.
- Narration never auto-advances. The child taps Next.

## No reading to navigate

- Icons, avatars and pictures carry the meaning. Text is a caption.
- `KidButton` hides its label visually and speaks it. Show a caption only where the icon alone is ambiguous (Done, Start, Keep going, Story again).
- The kid zone has no menus, tabs or settings. A grown-up reaches settings through the quiet lock and the PIN.

## Contrast and colour

- Text holds 4.5:1 on its ground in both themes. Control borders, icons and the focus ring hold 3:1.
- The focus ring is 3px solid `focus` with a 3px offset, in both zones.
- No state relies on colour alone:
  - Choice tiles: check badge, sprout badge, dashed rest.
  - Skill states: icon, word, border style.
  - Progress dots: the current dot is a wider pill.
  - Toggles: an On/Off word.
- Hit and miss are green and blue, never green and red.

## Fonts

- Atkinson Hyperlegible is the default body face.
- A dyslexia-friendly mode (`.bt-dys`) swaps every family to Lexend and widens letter and word spacing. It's set per child in the profile.

## Screen readers

- Every control has a spoken name.
- Avatar tiles say "Maya, the penguin". Choice tiles say "7, right answer" after answering.
- The number line is an ARIA slider and arrow keys move it.
- Feedback panels and PIN errors are live regions.
- Emoji pictures carry `aria-label`s such as "7 fish" or "7 dots in a ten-frame".

## Touch and devices

- Kid targets are at least 64pt. They scale 1.4× on tablets.
- Parent targets are at least 48px. PIN keys are 76px.
- Every drag has a tap alternative (number line nudge buttons).
- Effects stay cheap for low-end Android:
  - Solid ledges, not blurred shadows.
  - One blurred shadow per screen.
  - Opacity and transform animations only.
