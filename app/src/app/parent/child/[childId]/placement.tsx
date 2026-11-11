import type { ChildProfile } from '@bright-trail/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { loadContent } from '../../../../content';
import { StateBadge } from '../../../../parent/components/StateBadge';
import {
  EmptyState,
  ParentRow,
  ParentScreen,
  Section,
  styles as ui,
} from '../../../../parent/components/ui';
import { gradeLabel } from '../../../../parent/grades';
import { placementResults, type PlacementResultRow } from '../../../../parent/skillTree';
import type { StoredPlacement } from '../../../../storage/repository';
import { useStorage } from '../../../../storage/StorageProvider';

function placedLine(placement: StoredPlacement | null): string {
  if (!placement) return 'Placement hasn’t run yet.';
  if (!placement.finishedAt) return 'Placement is still going. It continues next session.';
  return placement.placedGrade
    ? `Placed at ${gradeLabel(placement.placedGrade)}.`
    : 'Placed above every grade in the content.';
}

/** What placement found for each skill it asked about, for the parent's spot-check of 10. */
export default function PlacementReviewScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [placement, setPlacement] = useState<StoredPlacement | null>(null);
  const [rows, setRows] = useState<PlacementResultRow[] | null>(null);

  useEffect(() => {
    (async () => {
      const [profile, bundle, saved, attempts] = await Promise.all([
        repo.children.get(childId),
        loadContent(repo),
        repo.placement.get(childId),
        repo.attempts.listForChild(childId),
      ]);
      setChild(profile);
      setPlacement(saved);
      setRows(saved ? placementResults(bundle.skills, saved.state, attempts) : []);
    })();
  }, [repo, childId]);

  return (
    <ParentScreen title="Placement review" backLabel={child?.firstName ?? 'Back'}>
      <Text style={ui.text}>
        Pick 10 skills and check each against what you know of your child. The bar is agreeing on 8
        of 10.
      </Text>
      <Section
        title={rows ? `${rows.length} placed skills` : 'Placed skills'}
        description={rows && rows.length > 0 ? placedLine(placement) : undefined}
        padded={false}
      >
        {rows && rows.length === 0 && (
          <EmptyState
            icon="list"
            title={placedLine(placement)}
            body={`It starts the first time ${child?.firstName ?? 'your child'} taps Let’s go on the trail.`}
          />
        )}
        {rows?.map(({ skill, passed, answered, correct }, i) => (
          <ParentRow
            key={skill.id}
            first={i === 0}
            title={skill.title}
            meta={`${gradeLabel(skill.grade)} · ${correct} of ${answered} right`}
            trailing={<StateBadge state={passed ? 'mastered' : 'gap'} />}
          />
        ))}
      </Section>
    </ParentScreen>
  );
}
