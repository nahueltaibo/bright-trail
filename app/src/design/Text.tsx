import { createContext, useContext, type ComponentProps } from 'react';
import { Text as NativeText, StyleSheet } from 'react-native';
import { dyslexicFont } from './tokens';

const DyslexicFontContext = createContext(false);

/** Turns the dyslexia font on for every design `Text` below it. */
export const DyslexicFontProvider = DyslexicFontContext.Provider;

export const useDyslexicFont = () => useContext(DyslexicFontContext);

/**
 * React Native's `Text`, in Lexend when the dyslexia font is on. Kid-zone code uses this one,
 * since styles are built once at import and can't follow the setting themselves.
 */
export function Text({ style, ...props }: ComponentProps<typeof NativeText>) {
  const dyslexic = useDyslexicFont();
  const swap = dyslexic ? dyslexicFont(StyleSheet.flatten(style)) : null;
  return <NativeText {...props} style={swap ? [style, swap] : style} />;
}
