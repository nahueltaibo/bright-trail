import type { ChildProfile } from '@bright-trail/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { loadBundle } from '../../../../content/loadBundle';
import { StateBadge } from '../../../../parent/components/StateBadge';
import { ParentScreen, Section, styles as ui } from '../../../../parent/components/ui';
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
        loadBundle(),
        repo.placement.get(childId),
        repo.attempts.listForChild(childId),
      ]);
      setChild(profile);
      setPlacement(saved);
      setRows(saved ? placementResults(bundle.skills, saved.state, attempts) : []);
    })();
  }, [repo, childId]);

  return (
    <ParentScreen title={child ? `${child.firstName}'s placement` : 'Placement'}>
      <Section>
        <Text style={ui.muted}>
          Pick 10 skills and check each against what you know of your child. The bar is agreeing on
          8 of 10.
        </Text>
        {rows && <Text style={ui.text}>{placedLine(placement)}</Text>}
      </Section>
      <Section title={rows ? `${rows.length} placed skills` : 'Placed skills'}>
        {rows?.map(({ skill, passed, answered, correct }) => (
          <View key={skill.id} style={ui.row}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{skill.title}</Text>
              <Text style={ui.muted}>
                {gradeLabel(skill.grade)} · {correct} of {answered} right
              </Text>
            </View>
            <StateBadge state={passed ? 'mastered' : 'gap'} />
          </View>
        ))}
      </Section>
    </ParentScreen>
  );
}
