# FeedbackPanel

Instant feedback shared by every item: a star for a hit, a sprout and a one-sentence why for a miss.

Provide `result` (`hit` or `miss`), `why` (misses only) and `onNext`.

- Copy is fixed: "Yes! Great job!" and "Good try!". The why is one short sentence that teaches, never blames.
- Narration reads the title and the why, then waits. No auto-advance.
- Slides up over `dur-base` with `ease-gentle`. Off under reduced motion.
