BrightTrail is a math app where a child walks a bright trail, one skill at a time. The system has two zones that share tokens: a **warm, playful kid zone** and a **calm, plain parent zone**. Wrap kid screens in `.bt-kid` and parent screens in `.bt-parent`. Never mix them on one screen.

## Voice

Kids hear every word before they read it. Write for the ear.

- Short, warm, spoken sentences: "Pip catches five fish. One, two, three, four, five!"
- Praise the try, not the kid: "Yes! Great job!" and "Good try!" are the only two verdicts.
- A miss gets one sentence of why that teaches: "Count the five, then two more: 5, 6, 7." Never "wrong", "oops" or "no".
- Placement is exploring, never testing. Say explore, puzzles, find your spot. Never test, quiz, score, level or grade.
- Parent copy is plain and exact: "Pick 10 skills and check each against what you know of your child." Name consequences in full: "This can't be undone."
- Sentence case everywhere. Curly apostrophes. No exclamation marks in the parent zone.
- Emoji are content, not decoration. They draw counting pictures and avatars, and appear nowhere else.

## Colour

The kid zone is cream and amber. Set every kid screen on `kid-bg` with `kid-ink` text. Lifted cards (story card, choice tiles, stones, avatar tiles) use `kid-surface-raised`. Soft controls (keypad keys, replay) use `kid-surface`.

- `trail` amber is the brand. Spend it on the one primary action per screen, the walked trail and the next stop. Put `on-trail` text on it, never white.
- `star` with a `star-ink` outline is the only reward colour. Draw it only as a star.
- A hit is `hit-ink` on `hit-bg`. A miss is calm blue, `miss-ink` on `miss-bg`. **Never use red in the kid zone.** `p-danger` exists for parents only.
- `meadow` is the trail map's ground. `sun` is the glow ring around the next stop. Both are decoration.
- Avatar discs use `av-peach`, `av-mint`, `av-sky` and `av-lilac`, fixed per animal.

The parent zone is grey and blue. Use `p-bg` for the page, `p-surface` cards with a `p-line` edge, `p-ink` text, `p-ink-muted` meta lines and `p-primary` for actions and links. `p-danger` marks destructive actions and errors only. `p-ok` marks a done status, always with a check icon.

Both themes are designed. Dark mode keeps the warmth: brown-black grounds, cream ink, the same amber.

## Skill states

Parents see six skill states. Each one has an icon, a word and a border style, so colour is never the only signal.

| State | Icon | Border | Meaning |
| --- | --- | --- | --- |
| Unknown | ? | dashed | Not asked yet |
| Assumed | half circle | dotted | Taken as known from grade |
| Gap | broken ring | solid | Missed, taught next |
| Learning | sprout | solid | Story seen, check not passed |
| Mastered | star | thick | 4 of 5 right in a check |
| Review due | circular arrow | solid | Mastered, due for 3 questions |

Use `state-<name>` ink on `state-<name>-bg`. Gap is orange, never red. Kids never see these words. On the trail they see stars, a review badge and the glowing next stone.

## Type

- **Baloo 2** (`font-display`) is the kid voice: rounded and friendly, with numerals that can't be mistaken. Use it for prompts, numbers, buttons and greetings.
- **Atkinson Hyperlegible** (`font-body`) is for narration captions and the whole parent zone. Its letterforms keep 1, l and I apart, and 0 and O.
- **Lexend** (`font-dyslexic`) is the dyslexia-friendly option. Add `.bt-dys` to the screen root to swap both families and widen letter and word spacing.

Kid styles: `kid-numeral` (64) for story numbers and the keypad display, `kid-choice` (48) on tiles, `kid-hero` (40) for greetings and end screens, `kid-prompt` (28) for questions, `kid-caption` (18) for names and button captions, and `kid-narration` (20, 24 in reading mode). Parent styles: `p-title` (24), `p-heading` (17), `p-body` (16), `p-label` (14), `p-meta` (13).

## Size and spacing

- Every kid tap target is at least `tap-kid` (64pt). Parent targets are at least `tap-parent` (48px).
- Kid sizes scale by `scale-tablet` (1.4) when the short side is 600pt or more. In CSS this is `--s`, set by `.bt-tab`. Write kid sizes as `calc(N * var(--s))`.
- Space on a 4px base: `space-4` phone gutters, `space-6` between parent sections, `space-8` between kid blocks.
- Radii grow with friendliness: `radius-sm` for parent inputs, `radius-md` for parent cards and keys, `radius-lg` for choice tiles, `radius-xl` for story cards and panels, `radius-pill` for kid buttons, chips and badges.

## Depth

Kid pressables sit on a solid ledge (`shadow-ledge`, `shadow-ledge-trail`): a 4px offset with no blur, so it's cheap on low-end Android. On press the ledge drops away and the control moves down 3px. Only the story card gets a soft blurred shadow (`shadow-lift`). Parent cards use `shadow-card` and a `p-line` edge.

## Motion

Motion is gentle, short and skippable. Everything moves on `ease-gentle`, with no bounce and no overshoot.

- `dur-press` (90ms): the ledge press.
- `dur-quick` (160ms): a tile changing colour after an answer, the switch thumb.
- `dur-base` (240ms): the feedback panel rising, a story card changing.
- `dur-star` (600ms): a star landing on the trail. Nothing runs longer.

Animate only opacity and transform. Never loop motion on a screen a child is reading, except the loading pebbles. Under reduced motion, every animation and transition is off. A tap anywhere skips the star landing.

## Layout

One idea per screen. Every kid screen follows the same skeleton:

- **Top bar:** replay (speaker) at top-left. Flag or quiet controls at top-right. Progress dots or pause in the middle.
- **Main:** the prompt, the visual, the answer.
- **Bottom:** one primary action, plus at most one plain one.

Landscape splits the question (45%) and the answer (55%). Story Back and Next move to the sides of the card. On phone landscape the keypad display sits beside the keys.

Parent screens share `ParentFrame`: a back link that names where it goes, a title, and a scrolling column of `Section`s. Tablets use two columns (`.bt-pcols`) or a 640px form column (`.bt-pnarrow`).

## Logo

The mark is a cream trail winding up to a star on `trail` amber. The wordmark is Baloo 2 ExtraBold, drawn as outlines: "Bright" in `kid-ink` and "Trail" in `trail-deep`.

- Use `logo.svg` on light grounds and `logo-dark.svg` on dark ones. Use `mark.svg` alone in square spaces.
- Keep clear space of a quarter of the mark's height on every side.
- Don't recolour, outline, rotate or stretch it. Don't set the name in another face.
- The app icon and Android's adaptive and themed layers use the same art, without the rounded corners.

## Pictures and icons

Pictures come from data through `EmojiVisual`: a single emoji, a row of N grouped in fives, or ten-frames. Its `slot` kind marks the 16:9 box where illustrations will go later. The ten avatars are fox, owl, penguin, frog, lion, unicorn, octopus, dinosaur, panda and cheetah, drawn as emoji on a tinted disc.

Icons are the bundle's own line set (`Icon`), 24px grid, round caps, `currentColor`. Kid icons stroke at 2.6 to 3.2.

## Rewards

Stars are the only reward. No streaks, timers, scores, leaderboards, lives, badges or countdowns. The star count sits beside Start and on the session-end screen, never on an item screen.
