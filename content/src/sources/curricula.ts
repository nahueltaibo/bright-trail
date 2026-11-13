import type { Framework, Subject } from '@bright-trail/shared';

export const API = 'https://ws.api.dcp.edu.gov.on.ca/content/api/items/';

export interface Curriculum {
  subject: Exclude<Subject, 'math'>;
  /** The subject's `l1___curriculum` item. Codenames are copies of copies, so don't guess them. */
  codename: string;
  title: string;
}

/** Math and Kindergarten keep their hand-refreshed Strand B and A6 files. See `content/sources/README.md`. */
export const CURRICULA: readonly Curriculum[] = [
  {
    subject: 'language',
    codename: 'ele___lang___fra',
    title: 'The Ontario Curriculum, Grades 1–8: Language',
  },
  {
    subject: 'science',
    codename: 'elementary___the_arts__copy__9c55991',
    title: 'The Ontario Curriculum, Grades 1–8: Science and Technology',
  },
  {
    subject: 'social-studies',
    codename: 'ele___sshh_curriculum',
    title:
      'The Ontario Curriculum: Social Studies, Grades 1 to 6; History and Geography, Grades 7 and 8',
  },
  {
    subject: 'french',
    codename: 'ele___fsl',
    title: 'The Ontario Curriculum: French as a Second Language',
  },
  {
    subject: 'health',
    codename: 'elementary___health_and_physical_education__2019_',
    title: 'The Ontario Curriculum, Grades 1–8: Health and Physical Education',
  },
  {
    subject: 'arts',
    codename: 'elementary___the_arts_4877b9e',
    title: 'The Ontario Curriculum, Grades 1–8: The Arts',
  },
];

/** The Kindergarten course item. One document covers every subject, so its strands get split. */
export const KINDERGARTEN: { codename: string; title: string; framework: Framework } = {
  codename: 'kindergarten',
  title: 'Kindergarten Curriculum (2026)',
  framework: 'ontario-kindergarten-2026',
};

/** Overall expectations each subject's `kindergarten.md` keeps. */
export const KINDERGARTEN_SPLIT: Readonly<
  Partial<Record<Curriculum['subject'], readonly string[]>>
> = {
  language: ['A1', 'A2', 'A3', 'A4'],
  science: ['B11', 'B12', 'B13'],
  health: ['C14', 'C15', 'C16', 'C17', 'C18'],
  'social-studies': ['D19', 'D20', 'D21', 'D22', 'D23'],
  arts: ['D24', 'D25'],
};

/** Math expectations, which `math/kindergarten.md` keeps by hand. A new code outside both lists stops the fetch. */
export const KINDERGARTEN_MATH: readonly string[] = ['A5', 'A6', 'A7', 'A8', 'A9', 'A10'];

/** FSL runs three programs. Only immersion spans Grades 1–6, so only it is fetched. Its files take this prefix. */
export const FSL_PROGRAMS: Record<string, string | undefined> = {
  core_french: undefined,
  extended_french: undefined,
  french_immersion: 'immersion',
};
