# Curriculum Sources

Official Ontario curriculum text, one folder per subject. Each file keeps the official wording and expectation codes. Don't edit it by hand. Re-fetch it instead.

## What's Here

| Folder | Source | Files |
|---|---|---|
| `math/` | *Mathematics, 2020*, Strand B: Number, and *Kindergarten (2026)*, Strand A | `kindergarten.md` (A6), `grade-1.md` … `grade-6.md` (B1, B2) |
| `language/` | *Language, 2023*, and *Kindergarten (2026)*, A1–A4 | `kindergarten.md`, `grade-1.md` … `grade-6.md` |
| `science/` | *Science and Technology, 2022*, and *Kindergarten (2026)*, B11–B13 | `kindergarten.md`, `grade-1.md` … `grade-6.md` |
| `social-studies/` | *Social Studies, Grades 1 to 6; History and Geography, Grades 7 and 8*, 2026, and *Kindergarten (2026)*, D19–D23 | `kindergarten.md`, `grade-1.md` … `grade-6.md` |
| `french/` | *French as a Second Language, 2013* | `immersion-grade-1.md` … `6` (French Immersion only) |
| `health/` | *Health and Physical Education, 2019*, and *Kindergarten (2026)*, C14–C18 | `kindergarten.md`, `grade-1.md` … `grade-6.md` |
| `arts/` | *The Arts, 2009*, and *Kindergarten (2026)*, D24–D25 | `kindergarten.md`, `grade-1.md` … `grade-6.md` |

- The skill graph build reads every folder in `SUBJECTS` that has files.
- Math files keep each specific expectation's Examples and Key concepts. Sample tasks are left out.
- Other subjects keep every strand, its "Why is this learning important?" and overview, and each specific expectation's Examples, Key concepts, and Knowledge and skills. Teacher prompts, instructional tips, sample questions, and student talk are left out.
- Images appear as their official alt text.
- Kindergarten uses the 2026 curriculum, which replaces *The Kindergarten Program, 2016* from the 2026–27 school year. One document covers every subject, so each subject's `kindergarten.md` keeps only its overall expectations. Math keeps A6 by hand. A5 and A7–A10 aren't kept anywhere.

All files come from the Curriculum and Resources site ([dcp.edu.gov.on.ca](https://www.dcp.edu.gov.on.ca/en/)). The site renders in the browser, so the text comes from the public content API it uses.

## Refreshing Every Subject but Math

```sh
npm run content:sources                      # every subject
npm run content:sources -- --subject science # one subject, repeatable
```

`content/src/sources/curricula.ts` lists each subject's curriculum item. The script reads its Grade 1–6 courses, fetches each one's strands, and writes Markdown in the layout below. It also splits the Kindergarten strands by the codes in `KINDERGARTEN_SPLIT`, and stops if the Ministry adds or drops an overall expectation that isn't filed there or in `KINDERGARTEN_MATH`. It stops when the API reports a newer curriculum year than the subject's framework in `shared/src/skill.ts`. Add a framework for the new document before you refresh it.

```md
## Strand B: Life Systems
### B1. Relating Science and Technology to Our Changing World
**B1.** assess ways in which plants are beneficial …
#### B1.1 Growth and Changes in Plants
**B1.1** assess ways in which plants are important …
**Examples**
```

## Refreshing Math

Math was converted by hand, and only Strands A6 and B, so the script doesn't write it.

1. Fetch each item from the API:

   ```sh
   curl -s "https://ws.api.dcp.edu.gov.on.ca/content/api/items/<codename>?language=en-CA&depth=6"
   ```

2. Use these codenames. Some don't match their grade, so copy them as written.

   | Grade | Codename |
   |---|---|
   | 1 | `math___grade_1___b` |
   | 2 | `math___grade_1___b__copy_` |
   | 3 | `math___grade_3___b` |
   | 4 | `math___grade_4___b` |
   | 5 | `math___grade_4___b__copy_` |
   | 6 | `math___grade_6___b` |
   | K | `kinder___a___foundations_literacy_and_mathematics` (overall expectation `kinder___dlmb___oe17`) |

3. In the response, `item.elements.overall_expectations` lists the overall expectations in page order. Each one's `specific_expectations` lists its children. Codes are in `title_index` and wording is in `content`. Examples and Key concepts are the `elaborations` items tagged with those `pedagogical_supports` names. Embedded tables are `<object>` tags that point at other items in `modular_content`.
4. Convert to Markdown in the existing layout and update the retrieval date in each header.
5. Check that the B1/B2 codes still run in order with no gaps, and diff against the old files.
