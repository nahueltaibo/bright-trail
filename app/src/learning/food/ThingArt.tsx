import { FRACTION_FOODS, type FractionFood } from '@bright-trail/shared';
import { useId } from 'react';
import Svg, { ClipPath, Defs, G, Path } from 'react-native-svg';
import { edgeLook, FoodArt } from './FoodArt';
import { wholeOf } from './geometry';

/** Round food cuts into wedges. Bars cut into strips. */
export const isRound = (food: FractionFood) => FRACTION_FOODS[food] === 'circle';

/** How tall a bar is next to its width, in a square slot. */
const BAR_HEIGHT = 0.42;

/** A whole thing in a square slot, for the sharing minigame. */
export function WholeThing({ food, size }: { food: FractionFood; size: number }) {
  const whole = isRound(food)
    ? wholeOf('circle', 1, size * 0.9, size * 0.9)
    : wholeOf('bar', 4, size, size * BAR_HEIGHT);
  return (
    <Svg width={size} height={size}>
      <G x={size / 2} y={size / 2}>
        <FoodArt food={food} whole={whole} />
      </G>
    </Svg>
  );
}

/** Wedge `index` of a round food cut into `den`, drawn where it sits in the whole. */
export function Wedge({
  food,
  size,
  den,
  index,
}: {
  food: FractionFood;
  size: number;
  den: number;
  index: number;
}) {
  const id = `wg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const whole = wholeOf('circle', den, size * 0.9, size * 0.9);
  const piece = whole.pieces[index % den];
  return (
    <Svg width={size} height={size}>
      <Defs>
        <ClipPath id={id}>
          <Path d={piece.d} />
        </ClipPath>
      </Defs>
      <G x={size / 2} y={size / 2}>
        <G clipPath={`url(#${id})`}>
          <FoodArt food={food} whole={whole} />
        </G>
        <Path d={piece.d} fill="none" strokeLinejoin="round" {...edgeLook(food)} />
      </G>
    </Svg>
  );
}

/** A bar cut into `den` strips. A piece shows one strip of it through a narrow window. */
export function BarStrips({ food, size, den }: { food: FractionFood; size: number; den: number }) {
  const whole = wholeOf('bar', den, size, size * BAR_HEIGHT);
  return (
    <Svg width={size} height={size}>
      <G x={size / 2} y={size / 2}>
        <FoodArt food={food} whole={whole} />
        {whole.pieces.map((p, i) => (
          <Path key={i} d={p.d} fill="none" {...edgeLook(food)} />
        ))}
      </G>
    </Svg>
  );
}
