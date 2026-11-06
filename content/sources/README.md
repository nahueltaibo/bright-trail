# Curriculum Sources

Official Ontario curriculum text that the skill graph build (C2) reads. Each file keeps the official wording and expectation codes. Don't edit the expectation text by hand. Re-fetch it instead.

## What's Here

| File | Source | Codes |
|---|---|---|
| `kindergarten.md` | Kindergarten Curriculum (2026), Strand A | A6, A6.1–A6.13 |
| `grade-1.md` … `grade-6.md` | *The Ontario Curriculum, Grades 1–8: Mathematics, 2020*, Strand B: Number | B1, B1.x, B2, B2.x |

- Grade files keep each specific expectation's Examples and Key concepts. Sample tasks are left out. Images appear as their official alt text.
- Kindergarten uses the 2026 curriculum, which replaces *The Kindergarten Program, 2016* from the 2026–27 school year.

## Where It Came From

- All files come from the Curriculum and Resources site ([dcp.edu.gov.on.ca](https://www.dcp.edu.gov.on.ca/en/)). The site renders in the browser, so the text was pulled from the public content API it uses.

## How to Refresh

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
