import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { font, radius, shadow } from '../../design/tokens';
import { gradeLabel } from '../grades';
import { GRAPH, STATE_STYLES, type SkillGraphLayout } from '../skillTree';
import { StateBadge, stateBorder } from './StateBadge';
import { colors } from './ui';

const ARROW = 7;

/**
 * The skill tree as a graph: grade columns, arrows from a skill to the skills it unlocks. It
 * scrolls sideways. Edges touching the selected skill turn the primary colour.
 */
export function SkillGraph({
  layout,
  selectedId,
  onSelect,
}: {
  layout: SkillGraphLayout;
  selectedId?: string;
  onSelect: (skillId: string) => void;
}) {
  const at = new Map(layout.nodes.map((n) => [n.skill.id, n]));
  const touches = ([from, to]: [string, string]) => from === selectedId || to === selectedId;
  // Highlighted edges draw last so they sit on top.
  const edges = [...layout.edges].sort((a, b) => Number(touches(a)) - Number(touches(b)));
  const { nodeWidth: NW, nodeHeight: NH } = GRAPH;

  return (
    <ScrollView horizontal contentContainerStyle={styles.scroll}>
      <View style={{ width: layout.width, height: layout.height }}>
        <Svg
          width={layout.width}
          height={layout.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {edges.map((edge) => {
            const a = at.get(edge[0])!;
            const b = at.get(edge[1])!;
            const x1 = a.x + NW;
            const y1 = a.y + NH / 2;
            const x2 = b.x - 1;
            const y2 = b.y + NH / 2;
            const m = (x1 + x2) / 2;
            const ink = touches(edge) ? colors.primary : colors.borderStrong;
            return (
              <Fragment key={edge.join('>')}>
                <Path
                  d={`M${x1} ${y1} C${m} ${y1} ${m} ${y2} ${x2 - ARROW} ${y2}`}
                  stroke={ink}
                  strokeWidth={touches(edge) ? 2.5 : 1.5}
                  fill="none"
                />
                <Path
                  d={`M${x2 - ARROW} ${y2 - ARROW / 2} L${x2} ${y2} L${x2 - ARROW} ${y2 + ARROW / 2} Z`}
                  fill={ink}
                />
              </Fragment>
            );
          })}
        </Svg>
        {layout.columns.map((c) => (
          <Text key={c.grade} style={[styles.column, { left: c.x }]}>
            {gradeLabel(c.grade)}
          </Text>
        ))}
        {layout.nodes.map(({ skill, state, x, y }) => {
          const selected = skill.id === selectedId;
          return (
            <Pressable
              key={skill.id}
              accessibilityRole="button"
              accessibilityLabel={`${skill.title}, ${STATE_STYLES[state].label}`}
              accessibilityState={{ selected }}
              onPress={() => onSelect(skill.id)}
              style={({ pressed }) => [
                styles.node,
                stateBorder(state),
                { left: x, top: y, width: NW, height: NH },
                selected && styles.selected,
                pressed && { backgroundColor: colors.sunken },
              ]}
            >
              <StateBadge state={state} compact />
              <Text style={styles.title} numberOfLines={3}>
                {skill.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  column: {
    ...font.body(700),
    position: 'absolute',
    top: 0,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  node: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    ...shadow.card,
  },
  selected: { backgroundColor: colors.primarySoft },
  title: { ...font.body(700), flex: 1, fontSize: 13, lineHeight: 16, color: colors.text },
});
