import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '../theme';
import type { ContainerKind } from '@bright-trail/shared';
import { HANDLE_HEIGHT, type Rect } from './share';
import type { Tone } from './Stage';
import { Text } from '../../design/Text';

type Look = {
  fill: string;
  edge: string;
  shape: (r: Rect) => ViewStyle;
  icon?: string;
  handle?: boolean;
};

const LOOKS: Record<ContainerKind, Look> = {
  plate: { fill: colors.surface, edge: colors.line, shape: () => ({ borderRadius: 999 }) },
  bowl: {
    fill: '#FDE2C8',
    edge: '#D9A066',
    shape: (r) => ({
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderBottomLeftRadius: r.h * 0.8,
      borderBottomRightRadius: r.h * 0.8,
    }),
    icon: '🥣',
  },
  basket: {
    fill: '#F3DDB3',
    edge: '#A9743B',
    shape: () => ({ borderRadius: 18, borderStyle: 'dashed', borderWidth: 4 }),
    icon: '🧺',
    handle: true,
  },
  bucket: {
    fill: '#DCEBFA',
    edge: '#5B86B5',
    shape: (r) => ({
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      borderBottomLeftRadius: r.h * 0.3,
      borderBottomRightRadius: r.h * 0.3,
    }),
    icon: '🪣',
    handle: true,
  },
  box: { fill: '#E9CFA3', edge: '#A07A45', shape: () => ({ borderRadius: 4 }), icon: '📦' },
  bag: {
    fill: '#EBD7B8',
    edge: '#9C7A4E',
    shape: (r) => ({
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      borderBottomLeftRadius: r.h * 0.2,
      borderBottomRightRadius: r.h * 0.2,
    }),
    icon: '🛍️',
  },
  cup: {
    fill: '#FFF1F4',
    edge: '#D98A9F',
    shape: (r) => ({
      borderTopLeftRadius: 4,
      borderTopRightRadius: 4,
      borderBottomLeftRadius: r.h * 0.45,
      borderBottomRightRadius: r.h * 0.45,
    }),
    icon: '🥤',
  },
  pond: { fill: '#CFE9F7', edge: '#5FA8D3', shape: () => ({ borderRadius: 999 }), icon: '💧' },
};

const TONES: Record<Tone, { fill: string; edge: string }> = {
  good: { fill: colors.good, edge: colors.goodInk },
  gentle: { fill: colors.gentle, edge: colors.gentleInk },
};

/** Draws what the things sit in. A tone colors it to point at a result. */
export function Container({ kind, rect, tone }: { kind: ContainerKind; rect: Rect; tone?: Tone }) {
  const look = LOOKS[kind];
  const { fill, edge } = tone ? TONES[tone] : look;
  const handleH = Math.min(rect.h * 0.3, HANDLE_HEIGHT);
  const icon = Math.min(rect.h * 0.35, 26);
  return (
    <>
      {look.handle && (
        <View
          style={[
            styles.handle,
            {
              left: rect.x + rect.w * 0.2,
              width: rect.w * 0.6,
              top: rect.y - handleH,
              height: handleH * 2,
              borderColor: edge,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.body,
          { left: rect.x, top: rect.y, width: rect.w, height: rect.h },
          { backgroundColor: fill, borderColor: edge },
          look.shape(rect),
        ]}
      />
      {look.icon && (
        <Text
          style={[
            styles.icon,
            {
              left: rect.x + rect.w - icon * 0.9,
              top: rect.y + rect.h - icon * 0.9,
              fontSize: icon * 0.8,
              lineHeight: icon,
            },
          ]}
        >
          {look.icon}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { position: 'absolute', borderWidth: 3 },
  handle: {
    position: 'absolute',
    borderWidth: 3,
    borderBottomWidth: 0,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
  },
  icon: { position: 'absolute' },
});
