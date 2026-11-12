import type { Subject } from '@bright-trail/shared';

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

/** FSL runs three programs. Only immersion spans Grades 1–6, so only it is fetched. Its files take this prefix. */
export const FSL_PROGRAMS: Record<string, string | undefined> = {
  core_french: undefined,
  extended_french: undefined,
  french_immersion: 'immersion',
};
