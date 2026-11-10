import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { DyslexicFontProvider, Text } from './Text';
import { dyslexicFont, font } from './tokens';

describe('dyslexicFont', () => {
  it('swaps Baloo 2 and Atkinson Hyperlegible for Lexend with wider spacing', () => {
    expect(dyslexicFont({ ...font.display(700), fontSize: 28, lineHeight: 34 })).toEqual({
      fontFamily: 'Lexend_500Medium',
      letterSpacing: 0.56,
      lineHeight: 34 * 1.12,
    });
    expect(dyslexicFont(font.body(700))).toEqual({
      fontFamily: 'Lexend_600SemiBold',
      letterSpacing: 0.28,
    });
  });

  it('leaves other faces and unstyled text alone', () => {
    expect(dyslexicFont({ fontFamily: font.mono, fontSize: 12 })).toBeNull();
    expect(dyslexicFont({ fontSize: 40 })).toBeNull();
    expect(dyslexicFont(undefined)).toBeNull();
  });
});

describe('Text', () => {
  const style = { ...font.body(), fontSize: 20 };

  it('keeps the design font when the dyslexia font is off', async () => {
    await render(<Text style={style}>Pip counts five fish.</Text>);
    expect(StyleSheet.flatten(screen.getByText('Pip counts five fish.').props.style)).toEqual(
      style,
    );
  });

  it('draws in Lexend when the dyslexia font is on', async () => {
    await render(
      <DyslexicFontProvider value>
        <Text style={style}>Pip counts five fish.</Text>
      </DyslexicFontProvider>,
    );
    expect(StyleSheet.flatten(screen.getByText('Pip counts five fish.').props.style)).toMatchObject(
      { fontFamily: 'Lexend_400Regular', fontSize: 20, letterSpacing: 0.4 },
    );
  });
});
